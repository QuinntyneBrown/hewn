/** The design system the mocks show (docs/mocks/pages/design-system/default.html): six token pages and seven components. */
export function mockDesignSystem(origin = 'http://127.0.0.1:5300'): unknown {
  const page = (folder: string, title: string, tokenCount: number | null = null, lightAndDark = false) => {
    const name = title.toLowerCase().replace(/ /g, '-');
    const path = `docs/design-system/${folder}/${name}.html`;
    return {
      page: name,
      title,
      path,
      previewUrl: `${origin}/preview/stub/${path}`,
      tokenCount,
      lightAndDark,
    };
  };
  return {
    sha: '8e2290a5c0ffee8e2290a5c0ffee8e2290a5c0ff',
    foundations: [
      page('foundations', 'Colour', 38, true),
      page('foundations', 'Typography', 9),
      page('foundations', 'Spacing', 12),
      page('foundations', 'Radius', 4),
      page('foundations', 'Elevation', 3),
      page('foundations', 'Motion', 4),
    ],
    components: ['Button', 'Input', 'Status badge', 'Table', 'Receipt card', 'Dialog', 'Toast'].map((t) =>
      page('components', t),
    ),
  };
}

export const noDesignSystem = { sha: null, foundations: [], components: [] };
