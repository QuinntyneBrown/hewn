# 29 · Update project skills

This is journey twenty nine of Hewn, the software factory: update project skills. Every project starts with skills copied from Greenlit, Hewn's skill library, and stage zero records the commit it copied in a skills lock. Greenlit keeps improving after that. This video shows an Owner seeing that a project's skills are behind, and bringing them up to date with a pull request that merges itself.

## The goal

When Greenlit's default branch is ahead of a project's skills lock, an Owner sees "Skills update available", with the number of commits. Choosing Update skills opens a pull request that updates the skill files and the lock, and it merges automatically when checks pass. Viewers see no link. This is for Owners, who keep each project's agents working with Greenlit's latest skills.

## Updating the skills

Here a project's lock is three commits behind Greenlit. The project header shows the Owner "Skills update available, three commits". The dialog lists Greenlit's commits since the locked one, newest first, and says the running increment finishes on the current skills. The Owner chooses Update skills. In under a second the pull request is open, the toast says it merges automatically when checks pass, and the link goes away. About eight seconds after the click the checks have passed, the pull request has merged, and the lock on the default branch names Greenlit's head.

When Greenlit can't be reached, the dialog says the skills weren't updated, and why. The project keeps running on the skills it has, and Try again sends the request once more.

## How it works

The design planned a worker run for this. But an update belongs to no direction and no stage, so the API does it itself, as the new decision record explains. The project page asks for the update only for Owners. The handler reads the lock from the repository, and asks Greenlit, through a bare git clone fetched at most once a minute, for the commits after it.

Update skills commits Greenlit's skill files and the new lock to a branch named for Greenlit's head, and opens the pull request. Folders the project kept at bootstrap stay its own. The update is recorded, and an event tells Mission Control to read it again. Only one update is open at a time.

A merger sweeps open updates every ten seconds. It waits while checks run, and merges once every check has passed. If the default branch moved, it puts the same files on top, and the checks run again. A failed check leaves the pull request open and unmerged, and the update is offered again.

This sequence shows the whole path, from the link to the merge.

## Tests

The backend tests go through the real API, against a real git repository standing in for Greenlit. The update test opens the pull request and checks the branch, the title, the new skill files, the folder the project kept, and the lock. Asking again returns the same pull request. Other tests cover skills already up to date, an unreachable Greenlit, and a Viewer, who is forbidden.

The merger tests merge once checks pass, rebase a branch that fell behind, and leave a failed one open. A repository with no CI at all reports no checks, so it would never merge. That test failed first, and now such an update merges once no check has appeared for two minutes. All three hundred and eighteen backend tests pass.

End to end, a behaviour test commits to the e2e stack's own Greenlit, then updates the skills in Mission Control and waits for the lock to reach Greenlit's head. Other tests cover the failed state and the Viewer. Visual tests compare the link and the dialog with their mocks, by default, busy and failed, and an accessibility test checks every state.

## The screens

A Viewer sees the project with no link. The dialog reads the same in dark mode, and on a phone.

## Recap

Journey twenty nine is complete. Owners see when Greenlit is ahead of a project's skills. Update skills opens a pull request with the new skill files and lock. And it merges itself once its checks pass. Next comes journey thirty.
