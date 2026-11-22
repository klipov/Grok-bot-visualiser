import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

test(
  "the Windows observer distinguishes bot names, activity markers and active task titles",
  {
    skip: process.platform !== "win32",
  },
  () => {
    const script = `
    . ./scripts/read-grok-office.ps1
    $records = @(
      Get-OfficeBot 'Sales Sam, Main Bot, Working' 'Sales Sam'
      Get-OfficeBot 'Sales Sam' 'Sales Sam'
      Get-OfficeBot 'Cathy, Working' 'Cathy, Working'
      Get-OfficeBot 'Manager Marg, Needs attention' 'Manager Marg'
    )
    $tasks = @(
      Get-OfficeTask 'Open task Write copy, Working' 'Write copy'
      Get-OfficeTask 'Open task Call leads, needs attention' 'Call leads'
      Get-OfficeTask 'Open done task Close pipeline, new reply' 'Close pipeline'
      Get-OfficeTask 'Open task Review artwork' 'Review artwork'
      Get-OfficeTask 'Open task Choose title, Working' 'Choose title, Working'
    )
    function Read-TestIds($ordering) {
      $rows = @(foreach ($slot in $ordering) {
        $name = if ($slot -eq 3) { 'Manager Marg' } else { 'Sales Sam' }
        @{ bot = Get-OfficeBot $name $name; runtimeId = @(42, 91, $slot) }
      })
      Set-OfficeDuplicateIds $rows
      $rows | ForEach-Object { $_.bot.id }
    }
    ConvertTo-Json -Depth 4 -InputObject @{
      bots=$records
      tasks=$tasks
      duplicateIds=@(Read-TestIds @(1,2,3))
      reorderedIds=@(Read-TestIds @(3,2,1))
    } -Compress
  `;
    const result = JSON.parse(
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          script,
        ],
        { encoding: "utf8" },
      ),
    );
    assert.equal(result.bots.length, 4);
    assert.equal(result.bots[0].status, "Working");
    assert.equal(result.bots[0].id, result.bots[1].id);
    assert.equal(result.bots[1].status, undefined);
    assert.equal(result.bots[2].name, "Cathy, Working");
    assert.equal(result.bots[2].status, undefined);
    assert.equal(result.bots[3].status, "Needs attention");
    assert.equal(new Set(result.duplicateIds).size, 3);
    assert.equal(result.duplicateIds[2], result.bots[3].id);
    assert.deepEqual(result.reorderedIds, [...result.duplicateIds].reverse());
    assert.deepEqual(result.tasks, [
      { task: "Write copy", status: "Working" },
      { task: "Call leads", status: "Needs attention" },
    ]);
  },
);
