# 35 · Choose a theme

This is journey thirty five of Hewn, the software factory: choose a theme. Anyone who signs in to Mission Control can pick Light, Dark or System for their device. This video shows the choice being made and surviving a reload, the operating system changing the theme live, how the tokens switch, and the tests that hold contrast in both themes.

## The goal

The requirement has two parts. With no saved choice, Mission Control follows the operating system's colour scheme. And when the user picks Light, Dark or System, their choice is kept across a reload, with text contrast of at least four and a half to one in both themes.

## Choosing and reloading

Here is Settings. The new Appearance section sits at the top, with System chosen, because nothing has been saved yet. The Owner picks Dark, and the whole page turns at once. They reload, and it stays dark, with Dark still chosen. Then Light, and another reload: light it stays. Finally System, which hands the decision back to the operating system.

## The operating system decides

With System chosen, the operating system's setting is followed live. The clip switches the OS between light and dark, and Mission Control follows each time, with no reload. A saved Light or Dark ignores the OS entirely.

## On a phone

The choice is per device, and a Viewer can make it too. On a phone, the menu drawer, Projects and the project page all draw in the chosen theme.

## How the tokens switch

The design tokens already held both themes. Every colour is a role, like the default foreground or the canvas, and the dark values are set in two places: on a root with the dark data theme, and under the dark colour scheme media query, unless the root says light. So the app never had to change a colour. It only sets or removes one attribute.

The theme service reads the saved choice from local storage under hewn dot theme. Light and Dark set the data theme attribute on the html element. System removes it, so the media query decides. If storage can't be read, the choice is System.

A short script in index html applies a saved Light or Dark before the first paint, so a reload never flashes the other theme. Settings' radios read the service's choice signal and call choose.

The class diagram shows Settings driving the service, which works through three small functions. The sequence shows the choice being saved, and the reload applying it before Angular starts.

## Tests

The theme functions have four unit tests: no choice or an unknown one is System, a saved Light or Dark reads back, a save survives blocked storage, and System removes the attribute. They failed first, because the module didn't exist.

The behaviour tests run in the browser with the OS preference emulated. With no choice, the page follows the OS as it changes. Dark and Light override the OS and survive a reload. System goes back to following it. And a Viewer's choice shows on every page. They failed first, because Settings had no Appearance section.

The contrast scan runs axe core on every page in light and in dark, and on a saved choice against the OS. It found something on the way: right after a switch, links ease their colour for a hundred and twenty milliseconds, and axe caught them mid fade. The scan now waits for the switch to finish. To prove it would catch a real problem, a dark text token was dropped to near black: every page failed. With the real tokens, none do.

The visual tests compare Appearance with its mock, in light and in dark.

## Recap

Journey thirty five is complete. Mission Control follows the operating system until you choose, and Light, Dark or System is kept on your device across reloads, applied before the first paint. Both themes hold four and a half to one contrast on every page, checked by axe core. Next comes journey thirty six.
