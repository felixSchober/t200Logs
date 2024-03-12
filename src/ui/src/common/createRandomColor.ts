/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

/**
 * Generates a random hex color string.
 * If `preventNearBlack` is true, the function ensures the color is not very dark.
 *
 * @param preventNearBlack Optional. If set, prevents the generation of near-black colors.
 * @returns The generated hex color string.
 */
export function createRandomColor(preventNearBlack?: boolean): string {
    let color = "#";
    for (let i = 0; i < 3; i++) {
      const value = Math.floor(Math.random() * 256);
      color += ("0" + value.toString(16)).substr(-2);
    }
  
    // If preventNearBlack is true, check if the generated color is too dark and regenerate if necessary.
    // This is a simple heuristic that checks if the hexadecimal color, when converted to an integer,
    // is below a certain threshold. Here, we're using 40 (hex: 28) for each RGB component as a threshold,
    // meaning if the color is darker than #282828, we consider it "very dark".
    if (preventNearBlack) {
      const isDark = parseInt(color.slice(1), 16) < parseInt("282828", 16);
      if (isDark) {
        return createRandomColor(preventNearBlack);
      }
    }
  
    return color;
  }
  