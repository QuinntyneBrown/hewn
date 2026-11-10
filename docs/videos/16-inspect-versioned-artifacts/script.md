# 16 · Inspect versioned artifacts

This is journey sixteen of Hewn, the software factory: inspect versioned artifacts. Every stage writes its output to the product's repository: the brief, the mocks, the design system, the requirements, the designs. Owners and Viewers want to open each of those at the exact commit a stage produced. This video walks through how it was built: the artifacts endpoint, the rules that decide what counts as an artifact, the new Artifacts tab, and the tests.

## The goal

A user opens a project's Artifacts and sees each stage's artifacts, newest stage first. Every row has the path, the version as a short commit SHA, the time, and a link that opens the file on GitHub at that very commit.

## The flow

Here is the flow. Workers already commit through Hewn's GitHub broker, which records each commit's SHA and paths against the run. So there is no separate recorder. Once a run succeeds, its commit is the version of the files it holds. When the tab asks, the API reads the commits of succeeded runs and shapes them into stages.

## The rules

The handler keeps only commits from runs that succeeded, so a failed attempt never becomes a version, and a retry's commit does. Commits to the scaffold or feature branches are left out, because the default branch is what the artifacts describe. The decision log every stage appends to has its own tab, so it is left out too. Each path's version is the latest commit that wrote it, and stages come newest first.

Stages write whole folders, such as a page per mock. Files inside a subfolder of the stage's output folder fold into that subfolder, which links to GitHub as a tree, not a blob. So stage two lists one row per page folder, not hundreds of files. Commit records now also keep their branch, so the read model can tell them apart.

## The tab

In Mission Control, each stage is a section headed by its number and name. Each row shows the path, the short SHA, and the time, as minutes ago within the hour, then as a day and time. The link opens in a new tab, and its accessible name says which file and which commit it opens. The tab reads the artifacts again whenever a stage changes, so new files appear without a reload.

## Tests

The backend tests came first, and failed with not found: there was no route. Four tests now cover the stages newest first with their links, folders folding into trees, the decision log left out, a failed run's commit replaced by the retry's, branch commits left out, Viewers, and an unknown project.

End to end, a live test opens the Artifacts tab on a new project, starts a real worker, and waits for the brief to appear with its seven character SHA and a link to GitHub at that full commit, without a reload.

All green, the backend has two hundred and thirty two tests, and the frontend three new view tests. End to end, there are eleven new tests: three for behaviour, one live pipeline run, three visual comparisons with the mocks, and four accessibility checks.

## The screens

Here is Kiln Booking. The Artifacts tab is open and empty while the worker starts. Then the stages succeed, and their files arrive, each with the commit that holds it. The brief links to GitHub at its commit, and the skills folders from bootstrap fold into one row each.

As a Viewer the tab reads the same, in light and in Mission Control's dark mode, and on a phone.

A project no stage has written to yet says there are no artifacts, while a failure says why, with try again.

## Recap

Journey sixteen is complete. Every stage's output is versioned by the commit that holds it, taken from the broker's own records of runs that succeeded. The Artifacts tab lists them newest stage first, with path, short SHA, time and a link to GitHub at that commit. And it stays current as stages finish. Next comes journey seventeen.
