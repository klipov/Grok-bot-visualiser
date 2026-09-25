import type { Point } from "./team";

export const OFFICE_WIDTH = 632;
export const OFFICE_HEIGHT = 424;

export function project(point: Point): Point {
  return {
    x: 295 + (point.x - point.y) * 17,
    y: 55 + (point.x + point.y) * 8.5,
  };
}
