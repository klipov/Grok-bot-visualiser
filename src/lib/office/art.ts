import { layoutOffice, type OfficeLayout, type Station } from "./layout";
import type { Bot, BotRole, Point } from "./team";

export function officeMetrics(layout: OfficeLayout) {
  return {
    width: Math.ceil((layout.width + layout.depth) * 17 + 64),
    height: Math.ceil((layout.width + layout.depth) * 8.5 + 104),
    originX: Math.ceil(layout.depth * 17 + 32),
    originY: 60,
  };
}

export function project(point: Point, layout: OfficeLayout, z = 0): Point {
  const metrics = officeMetrics(layout);
  return {
    x: Math.round(metrics.originX + (point.x - point.y) * 17),
    y: Math.round(metrics.originY + (point.x + point.y) * 8.5 - z),
  };
}

export const spriteForRole: Record<BotRole, string> = {
  Coordinator: "atlas",
  Researcher: "mira",
  Librarian: "fern",
  Engineer: "kit",
  Outreach: "reed",
  Designer: "designer",
  Analyst: "analyst",
  Generalist: "generalist",
};

export function drawOffice(roster: readonly Bot[]): HTMLCanvasElement {
  const layout = layoutOffice(roster);
  const metrics = officeMetrics(layout);
  const canvas = document.createElement("canvas");
  canvas.width = metrics.width;
  canvas.height = metrics.height;
  const pen = canvas.getContext("2d");
  if (!pen) throw new Error("This browser cannot draw the office artwork");
  pen.imageSmoothingEnabled = false;
  const p = (x: number, y: number, z = 0) => project({ x, y }, layout, z);
  function face(points: Point[], color: string) {
    pen!.fillStyle = color;
    pen!.beginPath();
    points.forEach((point, index) =>
      index ? pen!.lineTo(point.x, point.y) : pen!.moveTo(point.x, point.y),
    );
    pen!.closePath();
    pen!.fill();
  }
  function line(a: Point, b: Point, color: string, width = 1) {
    pen!.strokeStyle = color;
    pen!.lineWidth = width;
    pen!.beginPath();
    pen!.moveTo(a.x, a.y);
    pen!.lineTo(b.x, b.y);
    pen!.stroke();
  }
  function rect(x: number, y: number, w: number, h: number, color: string) {
    pen!.fillStyle = color;
    pen!.fillRect(Math.round(x), Math.round(y), w, h);
  }
  function plane(
    x: number,
    y: number,
    a: number,
    b: number,
    color: string,
    z = 0,
  ) {
    face(
      [p(x, y, z), p(x + a, y, z), p(x + a, y + b, z), p(x, y + b, z)],
      color,
    );
  }
  function cube(
    x: number,
    y: number,
    a: number,
    b: number,
    h: number,
    top: string,
    front = "#b77a52",
    side = "#d49d67",
    z = 0,
  ) {
    face(
      [p(x, y, z), p(x + a, y, z), p(x + a, y, z + h), p(x, y, z + h)],
      front,
    );
    face(
      [
        p(x + a, y, z),
        p(x + a, y + b, z),
        p(x + a, y + b, z + h),
        p(x + a, y, z + h),
      ],
      side,
    );
    plane(x, y, a, b, top, z + h);
  }
  function text(
    x: number,
    y: number,
    z: number,
    label: string,
    color = "#42616b",
    size = 8,
  ) {
    const point = p(x, y, z);
    pen!.font = `600 ${size}px monospace`;
    pen!.textAlign = "center";
    pen!.fillStyle = color;
    pen!.fillText(label, point.x, point.y);
  }
  function plant(x: number, y: number) {
    cube(x, y, 0.6, 0.6, 7, "#edb179", "#b96a55", "#d98d61");
    const point = p(x + 0.3, y + 0.3, 10);
    for (const [dx, dy, color] of [
      [-5, -4, "#4a9564"],
      [4, -5, "#5dac61"],
      [0, -10, "#80c76c"],
      [6, -10, "#9ad779"],
      [-3, -15, "#70ba62"],
    ] as const) {
      rect(point.x + dx - 3, point.y + dy - 3, 6, 6, color);
      line(point, { x: point.x + dx, y: point.y + dy }, "#5c965c");
    }
  }
  function books(x: number, y: number, count = 5, z = 0) {
    const colors = ["#ee8381", "#64bed0", "#f1c65b", "#a28cda", "#88bb6a"];
    for (let i = 0; i < count; i++) {
      const xx = x + (i % 2 ? 0.06 : 0);
      cube(
        xx,
        y,
        0.7,
        0.5,
        2,
        colors[i % 5],
        "#fff0cb",
        colors[i % 5],
        z + i * 3,
      );
      line(
        p(xx + 0.1, y + 0.51, z + i * 3 + 1),
        p(xx + 0.6, y + 0.51, z + i * 3 + 1),
        "#d5bd96",
      );
    }
  }
  function shelf(x: number, y: number, length = 3.7) {
    cube(x, y, length, 0.6, 35, "#edbd7c", "#b77951", "#d99d63");
    for (const z of [5, 16, 27]) {
      face(
        [
          p(x + 0.12, y + 0.62, z),
          p(x + length - 0.12, y + 0.62, z),
          p(x + length - 0.12, y + 0.62, z + 8),
          p(x + 0.12, y + 0.62, z + 8),
        ],
        "#875d48",
      );
      for (let k = 0; k < Math.floor(length * 4); k++) {
        const c = ["#e47d7a", "#70b5ce", "#b8ce76", "#edbd69", "#a18ad2"][
          k % 5
        ];
        cube(
          x + 0.15 + k * 0.24,
          y + 0.64,
          0.18,
          0.04,
          5 + ((k * 3) % 4),
          c,
          c,
          c,
          z,
        );
      }
      line(
        p(x + 0.08, y + 0.7, z),
        p(x + length - 0.08, y + 0.7, z),
        "#f4d395",
        2,
      );
    }
  }
  function desk(x: number, y: number, color = "#f2c37e", width = 3) {
    for (const [dx, dy] of [
      [0.15, 0.15],
      [width - 0.3, 0.15],
      [0.15, 1.2],
      [width - 0.3, 1.2],
    ])
      cube(x + dx, y + dy, 0.15, 0.15, 13, "#d59e65");
    cube(x, y, width, 1.5, 3, color, "#ba7c52", "#dda56a", 13);
    cube(x + 0.15, y + 0.9, 0.6, 0.45, 10, "#edb878", "#bc8058", "#d99f64", 2);
    for (const z of [5, 9])
      line(p(x + 0.2, y + 1.37, z), p(x + 0.7, y + 1.37, z), "#a87551");
  }
  function monitor(x: number, y: number) {
    cube(x + 0.4, y + 0.25, 0.2, 0.2, 4, "#7899b4", undefined, undefined, 16);
    cube(x, y, 1.15, 0.13, 11, "#a4bdd2", "#54728e", "#6f91ac", 20);
    face(
      [
        p(x + 0.1, y + 0.15, 29),
        p(x + 1.05, y + 0.15, 29),
        p(x + 1.05, y + 0.15, 22),
        p(x + 0.1, y + 0.15, 22),
      ],
      "#97ecd7",
    );
    for (let k = 0; k < 3; k++)
      line(
        p(x + 0.2, y + 0.16, 23 + k * 2),
        p(x + 0.7 + (k % 2) * 0.2, y + 0.16, 23 + k * 2),
        "#4c9fa7",
      );
    cube(x + 0.1, y + 0.85, 0.95, 0.4, 1, "#f2f2dc", undefined, undefined, 16);
    for (let k = 0; k < 4; k++)
      line(
        p(x + 0.2 + k * 0.18, y + 0.9, 17),
        p(x + 0.2 + k * 0.18, y + 1.15, 17),
        "#9eaeb0",
      );
  }
  function board(x: number, y: number, color = "#568f83") {
    cube(x, y, 3.1, 0.2, 25, "#e9bf7f", "#b6895f", "#d7aa72");
    face(
      [
        p(x + 0.15, y + 0.23, 23),
        p(x + 2.95, y + 0.23, 23),
        p(x + 2.95, y + 0.23, 5),
        p(x + 0.15, y + 0.23, 5),
      ],
      color,
    );
  }
  function room(station: Station) {
    const { bot, x, y, privateOffice } = station;
    const rugs: Record<BotRole, [string, string]> = {
      Coordinator: ["#ada0ed", "#8172c5"],
      Researcher: ["#86ddce", "#46a4aa"],
      Librarian: ["#c3e58c", "#8bac5c"],
      Engineer: ["#8ed3ed", "#589fbd"],
      Outreach: ["#ffb18a", "#e38073"],
      Designer: ["#eeb7d5", "#c887b3"],
      Analyst: ["#f3d68b", "#c3a757"],
      Generalist: ["#b3d6b7", "#7ea687"],
    };
    const [fill, edge] = rugs[bot.role];
    plane(x, y + 0.3, 5.4, 4.9, edge, 0.1);
    plane(x + 0.15, y + 0.45, 5.1, 4.6, fill, 0.2);
    cube(
      x - 0.15,
      y,
      5.65,
      0.15,
      privateOffice ? 41 : 25,
      "#fff1d1",
      "#c7d9b9",
      "#dce8c8",
    );
    cube(
      x - 0.15,
      y,
      0.15,
      5.1,
      privateOffice ? 35 : 12,
      "#fff1d1",
      "#aebc9f",
      "#dce8c8",
    );
    if (privateOffice) {
      cube(x + 5.35, y, 0.15, 5.1, 22, "#fff1d1", "#b6c5a9", "#dce8c8");
      cube(x, y + 5.05, 1.75, 0.15, 17, "#f4db9c", "#c3b08b", "#e5d3aa");
      cube(x + 4, y + 5.05, 1.5, 0.15, 17, "#f4db9c", "#c3b08b", "#e5d3aa");
      line(p(x + 1.85, y + 5.12, 0), p(x + 1.85, y + 5.12, 28), "#c9a164", 3);
      line(p(x + 3.95, y + 5.12, 0), p(x + 3.95, y + 5.12, 28), "#c9a164", 3);
      line(p(x + 1.85, y + 5.12, 28), p(x + 3.95, y + 5.12, 28), "#e9c983", 3);
      plane(x + 1.85, y + 4.95, 2.1, 0.4, "#f8df97", 0.3);
      board(x + 0.5, y + 0.45);
      for (let i = 0; i < 5; i++)
        cube(
          x + 0.8 + (i % 3) * 0.75,
          y + 0.7,
          0.5,
          0.03,
          4,
          "#f7db92",
          "#f7db92",
          "#f7db92",
          7 + Math.floor(i / 3) * 8,
        );
      desk(x + 1.05, y + 2.2, "#dca36e", 3.8);
      monitor(x + 1.3, y + 2.3);
      cube(x + 3.7, y + 2.4, 0.5, 0.4, 3, "#f3c95b", "#d69d41", "#dfb14e", 16);
      const cup = p(x + 3.95, y + 2.6, 23);
      rect(cup.x - 4, cup.y - 5, 8, 6, "#f1cc64");
      rect(cup.x - 1, cup.y + 1, 2, 5, "#d9a548");
      plane(x + 3, y + 3.15, 0.8, 0.5, "#fff2cd", 16);
      text(x + 2.7, y + 0.25, 40, "HEAD OFFICE", "#4a6657", 9);
    } else if (bot.role === "Librarian") {
      shelf(x + 0.3, y + 0.6, 4.4);
      shelf(x + 0.1, y + 2.1, 1.55);
      desk(x + 1.8, y + 2.6, "#e6ad76", 2.8);
      books(x + 2, y + 2.7, 5, 16);
      books(x + 0.5, y + 3.7, 8);
      books(x + 4.65, y + 2.6, 10);
      books(x + 4.6, y + 3.5, 6);
      plane(x + 3, y + 3.3, 1, 0.6, "#fff1cb", 17);
      line(p(x + 3.5, y + 3.3, 17), p(x + 3.5, y + 3.9, 17), "#b9a485");
    } else if (bot.role === "Researcher") {
      cube(x + 0.5, y + 0.65, 4.3, 0.85, 12, "#d4eee3", "#88b6b4", "#7ac9bd");
      for (let i = 0; i < 5; i++) {
        cube(
          x + 0.7 + i * 0.7,
          y + 0.9,
          0.35,
          0.35,
          7 + (i % 2) * 4,
          ["#8be4c1", "#b39ce5", "#83cfec"][i % 3],
          "#72b4bb",
          "#b3e5d4",
          12,
        );
        cube(
          x + 0.8 + i * 0.7,
          y + 1,
          0.15,
          0.15,
          3,
          "#f8efd4",
          undefined,
          undefined,
          21,
        );
      }
      desk(x + 0.8, y + 2.5, "#d2eade", 3.7);
      monitor(x + 1, y + 2.6);
      const a = p(x + 3.4, y + 3, 17);
      rect(a.x - 9, a.y - 2, 18, 5, "#587b9c");
      line({ x: a.x + 5, y: a.y }, { x: a.x + 5, y: a.y - 17 }, "#456d92", 5);
      line(
        { x: a.x + 5, y: a.y - 17 },
        { x: a.x - 4, y: a.y - 25 },
        "#6c94b1",
        6,
      );
      line(
        { x: a.x - 4, y: a.y - 25 },
        { x: a.x - 9, y: a.y - 18 },
        "#3f617e",
        5,
      );
      rect(a.x - 10, a.y - 6, 14, 3, "#8ab4bc");
    } else if (bot.role === "Outreach") {
      board(x + 0.6, y + 0.6, "#c99872");
      for (let i = 0; i < 6; i++)
        cube(
          x + 0.9 + (i % 3) * 0.7,
          y + 0.85,
          0.42,
          0.03,
          5,
          ["#f6df9b", "#efb0a6", "#a6d9d2"][i % 3],
          "#f6df9b",
          "#f6df9b",
          7 + Math.floor(i / 3) * 8,
        );
      desk(x + 0.8, y + 2.5, "#ffd49a", 3.6);
      desk(x + 4.3, y + 1.4, "#ffd49a", 0.8);
      monitor(x + 1, y + 2.6);
      cube(x + 3, y + 3, 0.9, 0.7, 4, "#f18b8b", "#bd5b73", "#db6e81", 16);
      const a = p(x + 3.45, y + 3.3, 26);
      line(
        { x: a.x - 10, y: a.y - 4 },
        { x: a.x + 8, y: a.y + 3 },
        "#c25776",
        6,
      );
      rect(a.x - 13, a.y - 7, 6, 6, "#ec7c93");
      rect(a.x + 5, a.y, 6, 6, "#ec7c93");
      for (let i = 0; i < 4; i++) {
        pen!.strokeStyle = "#97617d";
        pen!.beginPath();
        pen!.arc(a.x + 8, a.y + 8 + i * 3, 4, 0, Math.PI * 1.5);
        pen!.stroke();
      }
    } else if (bot.role === "Engineer") {
      cube(x + 0.2, y + 1.7, 0.9, 0.9, 29, "#789bc1", "#3f607f", "#587b9c");
      for (const z of [6, 12, 18, 24]) {
        line(p(x + 0.3, y + 2.62, z), p(x + 0.95, y + 2.62, z), "#99bdd0");
        const a = p(x + 0.85, y + 2.63, z);
        rect(a.x, a.y, 2, 2, "#9beaaf");
      }
      desk(x + 1.4, y + 2.2, "#c1ddec", 3.6);
      monitor(x + 1.6, y + 2.3);
      monitor(x + 3, y + 2.3);
      cube(x + 4.5, y + 0.7, 0.55, 0.8, 14, "#8eabc0", "#627f98", "#7997b0");
      plane(x + 1.5, y + 4, 3.5, 0.13, "#759eaa", 0.3);
    } else if (bot.role === "Designer") {
      cube(x + 0.5, y + 0.9, 0.2, 0.4, 30, "#d8a876");
      cube(x + 2, y + 0.9, 0.2, 0.4, 30, "#d8a876");
      face(
        [
          p(x + 0.35, y + 1.2, 30),
          p(x + 2.2, y + 1.2, 30),
          p(x + 2.2, y + 1.2, 9),
          p(x + 0.35, y + 1.2, 9),
        ],
        "#fff3d7",
      );
      face(
        [
          p(x + 0.5, y + 1.22, 27),
          p(x + 2, y + 1.22, 27),
          p(x + 2, y + 1.22, 12),
          p(x + 0.5, y + 1.22, 12),
        ],
        "#8dcee0",
      );
      face(
        [
          p(x + 0.5, y + 1.24, 12),
          p(x + 1, y + 1.24, 24),
          p(x + 1.6, y + 1.24, 12),
        ],
        "#7dad75",
      );
      desk(x + 1.2, y + 2.6, "#eac19b", 3.6);
      plane(x + 1.45, y + 2.75, 2.2, 1, "#fff4da", 17);
      for (let i = 0; i < 5; i++)
        cube(
          x + 4,
          y + 2.7 + i * 0.15,
          0.4,
          0.12,
          1,
          ["#de8b94", "#dab568", "#87bb9b", "#84b1cd", "#ad98ca"][i],
          undefined,
          undefined,
          17,
        );
      const a = p(x + 4.4, y + 1, 4);
      line(a, { x: a.x - 5, y: a.y - 26 }, "#bb868d", 3);
      line(a, { x: a.x + 3, y: a.y - 30 }, "#759fae", 3);
      cube(x + 4.1, y + 0.8, 0.65, 0.65, 12, "#e4b9ca", "#b57d9b", "#cd98b1");
    } else if (bot.role === "Analyst") {
      board(x + 0.5, y + 0.6, "#fff6d8");
      for (let i = 0; i < 5; i++) {
        const a = p(x + 0.8 + i * 0.4, y + 0.84, 7);
        rect(
          a.x - 3,
          a.y - (i + 1) * 3,
          5,
          (i + 1) * 3,
          ["#8db4b7", "#7ca8ad", "#78a2b4", "#7d9fa7", "#c09b55"][i],
        );
      }
      desk(x + 1.1, y + 2.6, "#ebce93", 3.5);
      monitor(x + 1.3, y + 2.7);
      plane(x + 3, y + 3, 1, 0.8, "#fff6dd", 17);
      for (let i = 0; i < 4; i++)
        line(
          p(x + 3.1, y + 3.1 + i * 0.15, 17),
          p(x + 3.8, y + 3.1 + i * 0.15, 17),
          "#c4b891",
        );
      cube(x + 4.5, y + 0.9, 0.6, 0.8, 10, "#c2a46e", "#997852", "#b28d5d");
    } else {
      desk(x + 1.1, y + 2.4, "#efc087", 3.4);
      monitor(x + 1.35, y + 2.5);
      books(x + 3.6, y + 2.6, 3, 16);
      cube(x + 0.6, y + 0.8, 1.1, 0.8, 9, "#b0cebb", "#78a28b", "#95b8a0");
      plant(x + 0.85, y + 0.95);
    }
    if (bot.role !== "Coordinator" && bot.role !== "Librarian")
      plant(x + 4.65, y + 3.8);
    const label = privateOffice ? `${bot.name}'s office` : bot.role;
    text(x + 2.7, y + 5.2, 0, label, "#4c6c70", 8);
  }

  rect(0, 0, canvas.width, canvas.height, "#bfe8ef");
  cube(
    -0.4,
    -0.4,
    layout.width + 0.8,
    layout.depth + 0.8,
    8,
    "#8ecf7d",
    "#6d9b62",
    "#568b60",
    -13,
  );
  cube(
    0,
    0,
    layout.width,
    layout.depth,
    9,
    "#f7dba8",
    "#d69768",
    "#e9b67b",
    -9,
  );
  for (let y = 0; y < layout.depth; y++)
    for (let x = 0; x < layout.width; x++) {
      plane(
        x,
        y,
        1,
        1,
        ["#f7dba8", "#ffe4b6", "#f6d4a1", "#f8deb1"][(x * 11 + y * 7) % 4],
      );
      line(p(x, y), p(x + 1, y), "#e4bf8a");
      if ((x + y) % 3 === 0)
        line(p(x + 0.15, y + 0.3), p(x + 0.7, y + 0.3), "#edc996");
    }
  cube(0, 0, layout.width, 0.18, 43, "#fff3d3", "#c8d9b9", "#e1ebcc");
  cube(0, 0, 0.18, layout.depth, 43, "#fff3d3", "#c8d9b9", "#e1ebcc");
  for (let x = 2; x < layout.width - 2; x += 6) {
    face(
      [p(x, 0.2, 35), p(x + 2.6, 0.2, 35), p(x + 2.6, 0.2, 10), p(x, 0.2, 10)],
      "#6798b5",
    );
    face(
      [
        p(x + 0.15, 0.22, 33),
        p(x + 2.45, 0.22, 33),
        p(x + 2.45, 0.22, 12),
        p(x + 0.15, 0.22, 12),
      ],
      "#7bd5ee",
    );
    line(p(x + 1.3, 0.23, 34), p(x + 1.3, 0.23, 11), "#fff4cc", 2);
    line(p(x, 0.23, 22), p(x + 2.6, 0.23, 22), "#fff4cc", 2);
  }
  [...layout.stations].sort((a, b) => a.x + a.y - b.x - b.y).forEach(room);
  return canvas;
}
