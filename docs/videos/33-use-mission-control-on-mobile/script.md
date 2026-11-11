# 33 · Use Mission Control on mobile

This is journey thirty three of Hewn, the software factory: use Mission Control on mobile. An Owner checking on a direction from a phone or a tablet needs every page to work there too. This video shows the same pages at phone, tablet and desktop widths, and the new menu drawer.

## The goal

Every page works from three hundred and twenty to two thousand five hundred and sixty pixels wide. On a phone, content is one column, navigation is a menu drawer, and the pipeline is a vertical list. On a tablet, the pipeline becomes a scrollable stepper above the stage detail. From nine hundred and ninety two pixels, navigation is a fixed sidebar, with the pipeline beside the detail. And no width scrolls sideways.

## Three widths

Here is one project at three widths. On the desktop, the sidebar is fixed on the left, and the pipeline sits beside the stage detail. On a tablet, the sidebar goes, and the eleven stages become a stepper that scrolls sideways, above the detail. On a phone, the stages stack into a list, and the detail follows it.

## On a phone

Before this journey, a phone showed only the wordmark at the top. There was no way to reach another page. Now the top bar has a menu button, the wordmark and the connection dot.

The Owner taps the menu. The drawer slides in, with the sidebar's own links, the workers and the account. Focus starts on Close, and stays inside the drawer. Escape closes it, and focus goes back to the menu button. The Owner opens it again and taps Projects. The page changes, and the drawer closes by itself. Then the Owner opens a project, and its pipeline is a list.

The drawer reads the same in dark mode.

## Touch targets

The requirement asked for forty four pixel touch targets at every width. But the design system draws thirty two and forty pixel buttons on the desktop, where a mouse is the pointer. So the requirement now asks for forty four pixels below nine hundred and ninety two, and twenty four, the accessibility minimum, from there up. A new decision record explains why.

On a phone, small and medium buttons, fields and tabs are now forty four pixels. The mocks read the same tokens, so they changed with the app, and no mock was edited.

## How it works

The shell keeps the sidebar's content in one template. From nine hundred and ninety two pixels it fills the fixed sidebar. Below that, the menu button opens the same template in a dialog labelled Menu. Navigating closes it, and so does widening the window, through one media query.

The tokens set small and medium controls to forty four pixels, and restore thirty two and forty from the large breakpoint. The rest of the layout was already in the design system's CSS: the columns, and the pipeline's three shapes.

The class diagram shows the shell owning the drawer. There's no breakpoint service any more, so the band never reaches TypeScript.

## Tests

A behaviour test opens the drawer at three hundred and seventy five pixels. It checks that focus starts on Close and stays inside, then closes the drawer with Escape, with Close, by navigating, and with a tap beside it. Before the change it failed, because there was no menu button.

The sweep visits every page at seven widths, from three hundred and twenty to two thousand five hundred and sixty. That's ninety one pages and widths, and none scrolls sideways. Another test measures the pipeline's shape at each width.

The touch target test measures every visible control. At first it found sixty six under forty four pixels on phones and tablets. After the token change, it found tabs squeezed narrower than their labels, so each tab now keeps its width, and then it found none. Visual tests compare the top bar and the drawer with their mocks, and an accessibility test checks the open drawer.

## Recap

Journey thirty three is complete. Phones and tablets get a menu drawer, and every page fits from three hundred and twenty to two thousand five hundred and sixty pixels. The pipeline is a list, a stepper, or a column beside the detail. And below nine hundred and ninety two pixels, every control is a forty four pixel touch target. Next comes journey thirty four.
