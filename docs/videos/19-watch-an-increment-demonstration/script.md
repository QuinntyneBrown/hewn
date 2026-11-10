# 19 · Watch an increment demonstration

This is journey nineteen of Hewn, the software factory: watch an increment demonstration. Once an increment's tests are green, stage ten records a short captioned walkthrough of it in the running app and commits it to the product's repository. Owners and Viewers want to watch that walkthrough without leaving Mission Control, and when it couldn't be recorded, to know why. This video walks through how it was built: serving the video from the repository, the player, the pull request link, and the tests.

## The goal

A user opens an increment and plays its walkthrough right on the page, with captions, play and pause, a seek bar and full screen. When the recording failed, the page says Video failed, with the reason, and that the pull request went ahead without it.

## The flow

Here is how the page plays it. The increment's details now carry two links when its video was recorded, one for the video and one for its captions. The player asks the API for the video in byte ranges, so it can seek. The API finds the stage ten commit that wrote the video, reads the file from GitHub at that commit, and answers with the part asked for. The captions come the same way.

Product repositories are private, so the browser can't fetch from GitHub itself. Serving through the API keeps the session's rules: a Viewer can watch, and anyone signed out is refused. That is recorded as A D R twenty one.

## Serving the video

The handler takes the video's folder, which the worker reported, and builds the file's path. It then looks through the stage ten commits, newest first, for the one whose paths include that file, and reads it at that commit. The branch is deleted after the squash merge, but the commit stays.

The endpoint returns the file with range processing on, so a seek asks only for the bytes it needs, and the captions endpoint returns the text track.

Here is what the API answers for Kiln Booking's first increment: recorded, with its folder, and the two links.

## The player

The player takes those links. Captions load as a text track, which the browser keeps hidden, so the player draws the current caption over the picture in the design system's style, and the captions button can turn them off.

The seek bar is a slider: arrow keys move five seconds, and Home and End go to the start and the end. It speaks its position in minutes and seconds.

Without a video, the page says why. A failed video gives its reason. A Blocked increment records none, and before green, it says the walkthrough records once every test is green.

## The pull request link

The pull request body linked the video by a relative path, and on GitHub that resolves under the pull request's own address, so the link was broken. Now the worker links the file at the commit that recorded it.

## Tests

The backend tests came first, and failed with not found: there was no route. Four now cover the video and captions served from the recording commit, a byte range, a failed video with no player, and Viewers. The worker test now expects the link at the commit.

End to end, a live test runs a real worker through a whole direction, then opens the first increment and plays the walkthrough it recorded, served by the API, with its caption showing.

All green, the backend has two hundred and forty eight tests, the worker one hundred and forty five, and the frontend four new view tests. End to end, there are ten new tests: four for behaviour, one live pipeline run, three visual comparisons with the mocks, and two accessibility checks.

## The screens

Here is Kiln Booking, built end to end by a real worker. From the backlog, its first increment opens with the walkthrough ready. Everything here is done from the keyboard. Space plays it, with the caption over the picture. The scripted worker records a three second title card in place of a real walkthrough. The arrow keys and Home seek, Enter turns the captions off and on, and Space plays it again.

As a Viewer the player reads the same in dark mode, and on a phone.

When the recording failed, the page gives the reason, and the timeline shows the pull request went ahead, with the same reason under its Notes.

Before green, and when Blocked, the page says when a walkthrough is recorded.

## Recap

Journey nineteen is complete. An increment's captioned walkthrough plays on its page, served from the commit that recorded it. A failed video says why, and never blocks the increment. And the pull request's link to the video now works. Next comes journey twenty.
