# 34 · Use keyboard and assistive technology

This is journey thirty four of Hewn, the software factory: use keyboard and assistive technology. Someone who works with a keyboard alone, or with a screen reader, has to be able to do everything an Owner does with a mouse. This video shows a direction submitted and cancelled without touching the mouse, what the screen reader hears when a stage changes, and the tests that hold every page to it.

## The goal

The requirement has four parts. Every page, in every state, passes axe core with no serious or critical problems. Everything can be reached and used from the keyboard, with a visible focus indicator and no traps. Stage changes are announced through a polite live region, at most once every five seconds for each project. And when the user prefers reduced motion, nothing animates.

## By keyboard

Here is the whole journey on the keyboard. The Owner tabs to New direction in the sidebar and presses Enter. They tab into Name and type it, then Idea, then tab to Start direction and press Enter. Every stop shows the blue focus ring.

On the project page, they tab to the Idea stage and press Enter, then move along the detail's tabs with the arrow keys. They tab to Cancel and press Enter. The dialog takes focus. Escape closes it, and focus goes back to Cancel. Enter opens it again, Tab reaches Cancel direction, and Enter cancels.

## What the screen reader hears

When a stage changes, the shell's live region says so, politely, so it waits for the screen reader to finish what it's reading. On the project page it says the stage, its name and its status. On Projects it starts with the project's name. A project gets at most one announcement every five seconds, and when several changes arrive in that time, only the latest is said. The clip shows each announcement on screen as the live region gives it to the screen reader.

## The axe report

Axe core runs on every page in every state the app has: loaded, loading, failed, empty, for an Owner and a Viewer, and with its dialogs open. The new sweep holds each page on its loading request, then fails it, and scans both. Across those scans there are no violations at all, not even minor ones.

## Reduced motion

With reduced motion on, the spinners stand still, the dialog appears without fading, and the drawer is simply there. The motion tokens drop to zero, and a test checks that nothing on the page runs for longer than a hundredth of a millisecond.

## How it works

The project page used to keep its own live region, and Projects, which also changes rows live, said nothing. Now one service, the status announcer, sits behind a single region in the shell. A project's first change goes out at once. Later changes wait for that project's five seconds, and the latest wins. Each project has its own clock, so one busy project never holds back another.

The project page feeds it each stage change. Projects feeds it when a row's stage or status changes.

The class diagram shows the shell rendering the message, with both pages feeding the announcer. The sequence shows three quick changes for one project becoming two announcements, five seconds apart.

## Tests

The announcer's unit tests use a fake clock: first change at once, the next held for five seconds, the latest winning, and each project on its own clock. They failed first, because there was no announcer.

The pipeline test runs two projects with workers and records the live region on Projects. Before the change it failed, because the region didn't exist. Now each project's announcements are at least five seconds apart.

The keyboard sweep tabs through thirteen pages, about three hundred stops, checking every stop for the focus ring and that focus comes back round. With the focus styles removed, it reports every stop. With them, none.

The loading and failure scans found one gap: Settings had no loading state. It showed the configured defaults, editable, until the saved ones arrived. Now it shows the skeletons from its mock, and a visual test compares them.

## Recap

Journey thirty four is complete. Every page works from the keyboard, with a focus ring at every stop and no traps. Stage changes are announced from one polite region, once every five seconds for each project, on the project page and on Projects. Axe core finds nothing in any state, and reduced motion means no motion. Next comes journey thirty five.
