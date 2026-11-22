# Read the already-open Windows app through UI Automation. Dot-source this
# script to test the label parser without accessing a desktop session.
$ErrorActionPreference = 'Stop'

function Get-OfficeHash([string]$value) {
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $digest = $hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($value)) }
    finally { $hash.Dispose() }
    return [BitConverter]::ToString($digest).Replace('-', '').ToLowerInvariant()
}

function Get-OfficeBot($label, $visibleName) {
    if ([string]::IsNullOrWhiteSpace($visibleName)) { return }
    $name = $visibleName.Trim()
    if ($label -ceq $name) {
        $markers = @()
    } elseif ($label.StartsWith($name + ', ', [StringComparison]::Ordinal)) {
        $markers = @($label.Substring($name.Length + 2) -split ', ')
    } else {
        return
    }
    # Chromium's AutomationId on these rows is a generated component ID.
    # An exact display-name hash survives list sorting and desktop restarts.
    $id = Get-OfficeHash $name
    $bot = @{ id = "grok-$($id.Substring(0, 32))"; name = $name }
    if ($markers -contains 'Needs attention') { $bot.status = 'Needs attention' }
    elseif ($markers -contains 'Working') { $bot.status = 'Working' }
    return $bot
}

function Set-OfficeDuplicateIds($rows) {
    foreach ($group in ($rows | Group-Object { $_.bot.id })) {
        if ($group.Count -lt 2) { continue }
        foreach ($row in $group.Group) {
            # UIA guarantees a distinct runtime ID for each extant element.
            $suffix = Get-OfficeHash ($row.runtimeId -join ',')
            $row.bot.id += "-$($suffix.Substring(0, 16))"
        }
    }
}

function Get-OfficeTask($label, $title) {
    if ([string]::IsNullOrWhiteSpace($title)) { return }
    $prefix = 'Open task ' + $title + ', '
    if (!$label.StartsWith($prefix, [StringComparison]::Ordinal)) { return }
    $markers = @($label.Substring($prefix.Length) -split ', ')
    if ($markers -contains 'needs attention') { return @{ task = $title; status = 'Needs attention' } }
    if ($markers -contains 'Working') { return @{ task = $title; status = 'Working' } }
}

function Find-OfficeElements($parent, $property, $value) {
    $condition = [Windows.Automation.PropertyCondition]::new($property, $value)
    $parent.FindAll([Windows.Automation.TreeScope]::Descendants, $condition)
}

function Test-OfficeClass($element, $class) {
    ($element.Current.ClassName -split ' ') -ccontains $class
}

function Test-OfficeGroupAvatar($element, $depth = 0) {
    if ($depth -gt 6) { return $false }
    $walker = [Windows.Automation.TreeWalker]::RawViewWalker
    $child = $walker.GetFirstChild($element)
    while ($null -ne $child) {
        if (Test-OfficeClass $child 'sand-group-avatar') { return $true }
        if ($child.Current.ControlType -ne [Windows.Automation.ControlType]::Text -and
            (Test-OfficeGroupAvatar $child ($depth + 1))) { return $true }
        $child = $walker.GetNextSibling($child)
    }
    return $false
}

# Chrome flattens the descendants of named buttons in the control view.
# Read only text that identifies a row or task, never its chat-preview siblings.
function Get-OfficeRawText($element, $prefix, $label, $depth = 0) {
    if ($depth -gt 6) { return }
    $walker = [Windows.Automation.TreeWalker]::RawViewWalker
    $child = $walker.GetFirstChild($element)
    while ($null -ne $child) {
        if ($child.Current.ControlType -eq [Windows.Automation.ControlType]::Text) {
            $text = $child.Current.Name
            if ($text) {
                if ($null -eq $label) {
                    if ($text.StartsWith($prefix, [StringComparison]::Ordinal)) { return $text }
                } elseif ($label -ceq ($prefix + $text) -or
                    $label.StartsWith($prefix + $text + ', ', [StringComparison]::Ordinal)) {
                    return $text
                }
            }
        } else {
            $text = Get-OfficeRawText $child $prefix $label ($depth + 1)
            if ($text) { return $text }
        }
        $child = $walker.GetNextSibling($child)
    }
}

function Get-OfficeHeaderName($header) {
    $walker = [Windows.Automation.TreeWalker]::RawViewWalker
    $child = $walker.GetFirstChild($header)
    while ($null -ne $child) {
        if (Test-OfficeClass $child 'sand-chat-header__name') {
            return Get-OfficeRawText $child '' $null
        }
        $child = $walker.GetNextSibling($child)
    }
}

function Add-VisibleOfficeTasks($window, $bots) {
    $type = [Windows.Automation.AutomationElement]::ControlTypeProperty
    $name = [Windows.Automation.AutomationElement]::NameProperty
    $panes = @(Find-OfficeElements $window $name 'Conversation details' |
        Where-Object { Test-OfficeClass $_ 'sand-info-pane' })
    if ($panes.Count -ne 1) { return }
    $headers = @(Find-OfficeElements $window $type ([Windows.Automation.ControlType]::Button) |
        Where-Object { Test-OfficeClass $_ 'sand-chat-header__identity' })
    if ($headers.Count -ne 1) { return }
    $ownerName = Get-OfficeHeaderName $headers[0]
    $owners = @($bots | Where-Object { $_.name -ceq $ownerName })
    if ($owners.Count -ne 1) { return }
    $tasks = @()
    $lists = Find-OfficeElements $panes[0] $type ([Windows.Automation.ControlType]::List)
    foreach ($list in $lists) {
        if ($list.Current.Name -notin @('Tasks', 'Coding')) { continue }
        foreach ($button in (Find-OfficeElements $list $type ([Windows.Automation.ControlType]::Button))) {
            $label = $button.Current.Name
            if ($label -cnotlike 'Open task *') { continue }
            $title = Get-OfficeRawText $button 'Open task ' $label
            $task = Get-OfficeTask $label $title
            if ($task) { $tasks += $task }
        }
    }
    if ($tasks.Count -and (Get-OfficeHeaderName $headers[0]) -ceq $ownerName) {
        $owners[0].task = ($tasks.task | Select-Object -Unique) -join ' / '
        $owners[0].status = if ($tasks.status -contains 'Needs attention') { 'Needs attention' } else { 'Working' }
    }
}

function Read-GrokOffice {
    $windows = @(Get-Process -Name 'Grok Bot' -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero })
    if (!$windows.Count) { return @{ error = 'Open Grok Bot on this Windows desktop, then show the Bots sidebar.' } }
    Add-Type -AssemblyName UIAutomationClient
    $name = [Windows.Automation.AutomationElement]::NameProperty
    $type = [Windows.Automation.AutomationElement]::ControlTypeProperty
    $matches = @(foreach ($process in $windows) {
        $window = [Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
        foreach ($sidebar in (Find-OfficeElements $window $name 'Bots')) {
            if (Test-OfficeClass $sidebar 'sand-agents-sidebar') {
                @{ window = $window; sidebar = $sidebar }
            }
        }
    })
    if ($matches.Count -ne 1) {
        return @{ error = 'Show the Bots sidebar in one signed-in Grok Bot window on this desktop.' }
    }
    $match = $matches[0]
    $buttons = @(Find-OfficeElements $match.sidebar $type ([Windows.Automation.ControlType]::Button))
    $rows = @()
    foreach ($button in $buttons) {
        if (!(Test-OfficeClass $button 'sand-agent-item')) { continue }
        # Some versions hide the group avatar from accessibility entirely.
        # The office's desk selector lets the user exclude those ambiguous rows.
        if (Test-OfficeGroupAvatar $button) { continue }
        $label = $button.Current.Name
        $visibleName = Get-OfficeRawText $button '' $label
        $bot = Get-OfficeBot $label $visibleName
        if (!$bot) { return @{ error = 'Expand the Bots sidebar so each name is visible, then try again.' } }
        if ($bot.status -eq 'Needs attention') {
            # For an awaiting row Grok replaces the last-message preview with
            # its explicit reason for waiting. Keep drafts and history private.
            $prompt = Get-OfficeRawText $button 'Waiting for you: ' $null
            if ($prompt -and $prompt -cne $bot.name) { $bot.task = $prompt }
        }
        $rows += @{ bot = $bot; runtimeId = $button.GetRuntimeId() }
    }
    if (!$rows.Count) {
        return @{ error = 'No bot rows are visible. Expand the Bots sidebar and its sections in Grok Bot.' }
    }
    Set-OfficeDuplicateIds $rows
    $bots = @($rows | ForEach-Object { $_.bot })
    Add-VisibleOfficeTasks $match.window $bots
    return @{ bots = $bots }
}

if ($MyInvocation.InvocationName -ne '.') {
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    try { $result = Read-GrokOffice }
    catch { $result = @{ error = 'The Grok Bot window could not be read. Show the Bots sidebar and try again.' } }
    [Console]::WriteLine((ConvertTo-Json -InputObject $result -Depth 4 -Compress))
}
