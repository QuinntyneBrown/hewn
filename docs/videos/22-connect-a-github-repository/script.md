# 22 · Connect a GitHub repository

This is journey twenty two of Hewn, the software factory: connect a GitHub repository. Every Hewn project lives in a GitHub repository. An Owner either names one they already have, or leaves the field empty and Hewn makes one. This video walks through how that works: checking an existing repository, creating a private one, protecting its default branch, and how every token Hewn uses is limited to one repository.

## The goal

An existing repository must be a GitHub URL that Hewn can write to, or nothing is created and the error says why. With no repository, stage 0 creates a private one under the configured owner, named from the project in kebab case. After stage 6, the default branch requires the CI checks. And every call to GitHub uses an installation token limited to the project's repository.

## An existing repository

When the Owner submits, the URL is checked first: it must be h t t p s, github dot com, owner, repo. Then Hewn asks GitHub, as its App, whether it can push there. A repository it can't find, or can't write to, is refused with the reason, on the field itself.

Here the Owner names a repository the App isn't installed on. The error says so and how to fix it. With one Hewn can write to, the project starts, and its page links the repository.

## A new repository

Here is the flow when there is no repository. When a worker first leases stage 0, the provisioner turns the project name into kebab case and looks it up. If it's absent, Hewn creates it, private, and tags it hewn, so a crashed attempt can be adopted rather than duplicated. Then stage 6 merges the scaffold and asks the API to protect the default branch.

Here, Kiln Scheduler is submitted with no repository. Moments later, stage 0 has made hewn builds slash kiln scheduler, and the link appears without a reload.

The fake GitHub keeps the record. The repository is private, tagged hewn, and once stage 6 has run, its default branch requires the backend, frontend and e2e checks.

## Scoped tokens

This is the change journey twenty two made. Every call for a project's repository exchanges the App's key for a token that names that one repository.

Creating a repository can't name it yet. That token used to carry every permission the App has, on every repository it can reach. Now it asks only to administer repositories.

And it's used for one call. Straight after creating the repository, Hewn asks for a token limited to the new repository, and tags it with that. A d r twenty four records this, with the App's permission set.

## Protection

Branch protection is a request the worker makes once the scaffold merges. The handler checks the worker's lease, refuses it outside stage 6, and sets the required checks with a repository token.

## Tests

The new tests record every token exchange against a stub GitHub. Creating a repository failed first: its token had no scope at all. Now three pass, and the backend has two hundred and seventy nine tests, all green.

End to end, the run pipeline test now reads the fake GitHub's record: a private repository from stage 0, and, once the run completes, the scaffold's checks required on the default branch. The checks on existing repositories were already covered by earlier journeys, and still pass.

## The screens

The repository error reads the same in dark mode, and on a phone.

## Recap

Journey twenty two is complete. An existing repository must be one Hewn can write to. Without one, stage 0 creates it private, and stage 6 protects it. Every token is limited to the project's repository, and the one that creates repositories can do nothing else. Next comes journey twenty three.
