import { DesignSystem, DesignSystemPage } from '@hewn/api';
import { pageDetail, pageLabel, pageSelection, systemCaption } from './design-system-view';

const page = (
  folder: string,
  name: string,
  title: string,
  extra: Partial<DesignSystemPage> = {},
) => ({
  page: name,
  title,
  path: `docs/design-system/${folder}/${name}.html`,
  previewUrl: `https://mocks.hewn.dev/preview/t1/docs/design-system/${folder}/${name}.html`,
  tokenCount: null,
  lightAndDark: false,
  ...extra,
});

const system: DesignSystem = {
  sha: '8e2290a5c0ffee',
  foundations: [
    page('foundations', 'colour', 'Colour', { tokenCount: 38, lightAndDark: true }),
    page('foundations', 'spacing', 'Spacing', { tokenCount: 1 }),
  ],
  components: [page('components', 'button', 'Button')],
};

describe('design system view', () => {
  it('captions the pages with their counts and the commit they were read at', () => {
    expect(systemCaption(system)).toBe(
      '2 foundations · 1 component · docs/design-system/ at 8e2290a',
    );
  });

  it('shows the chosen page while it exists, else the first token page, else the first component', () => {
    expect(pageSelection(system, 'docs/design-system/components/button.html')?.title).toBe(
      'Button',
    );
    expect(pageSelection(system, 'docs/design-system/foundations/gone.html')?.title).toBe('Colour');
    expect(pageSelection({ ...system, foundations: [] }, null)?.title).toBe('Button');
    expect(pageSelection({ sha: null, foundations: [], components: [] }, null)).toBeNull();
  });

  it('describes a token page by its count and themes, and a component page not at all', () => {
    expect(pageDetail(system.foundations[0])).toBe('38 tokens, light and dark');
    expect(pageDetail(system.foundations[1])).toBe('1 token');
    expect(pageDetail(system.components[0])).toBe('');
  });

  it('labels the frame with the page, the width and the theme', () => {
    expect(pageLabel('Colour', 992, 'light')).toBe('Design system page: Colour, 992 px, light');
  });
});
