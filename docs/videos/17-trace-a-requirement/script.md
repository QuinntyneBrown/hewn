# 17 · Trace a requirement

This is journey seventeen of Hewn, the software factory: trace a requirement. Every requirement Hewn writes should end up designed, walked through in a journey, tested and merged. Owners and Viewers want to pick any L2 and see where it stands, and to spot the ones that have no acceptance test. This video walks through how it was built: reading the repository at its head, the rules that decide what names a requirement, the Traceability tab, and the tests.

## The goal

A user opens an L2 in Traceability and sees its L1, the designs that cover it, the journeys it appears in, the test files whose traces to header names it, and the pull requests whose titles name it. An L2 with no test is marked no acceptance test, unless it is deferred.

## The flow

Here is the flow. The design planned a background indexer and a table of trace links. Instead, the tab asks the API, and the API downloads one archive of the repository at its head and lists its pull requests once. It parses the requirements, then matches each ID in the designs, journeys, test headers and pull request titles. That is recorded as A D R nineteen.

The components are simpler too. One handler sits beside the artifacts handler, behind the same projects controller, and nothing needs indexing or keeping in step.

## Reading the head

One archive gives every file at once, and its top folder names the commit, so each answer says which short SHA it was read at. Before stage five there is no L2 file, so there are no requirements and no need to list pull requests.

L2 headings must read L2, a number, a colon and a title. A heading that doesn't, or an ID used twice, is an error that names the commit and the line, rather than a half-built trace.

## What names a requirement

Each L2 gets its L1, then everything that names its ID. An ID is matched whole, so L2 zero zero one is never found inside L2 zero zero one zero. No acceptance test is true only when no test names it and it isn't deferred.

A test names a requirement only in its header: a traces to comment in the first twenty lines, in any of the usual comment styles. A later mention, or one in a document, doesn't count.

## The tab

In Mission Control, the list on the left searches by ID or title, and flags deferred requirements. The chosen L2 is in the address, so a link opens it directly. Its trace shows four columns with counts. Deferred shows its reason; otherwise a missing test shows the no acceptance test pill, with an icon and words, not colour alone.

## Tests

The backend tests came first, and failed with not found: there was no route. Six tests now cover the list and its L1s at the head commit, the four kinds of link with whole-ID matching, no acceptance test and deferred, a project before stage five, an unparsable heading that names its line, and Viewers.

End to end, a live test runs a real worker through a whole direction, then opens L2 zero zero one and finds the design stage seven wrote, the journey from stage eight, the test stage ten committed, and the pull request that merged it.

All green, the backend has two hundred and thirty eight tests, and the frontend four new view tests. End to end, there are eighteen new tests: five for behaviour, one live pipeline run, six visual comparisons with the mocks, and six accessibility checks.

## The screens

Here is Kiln Booking, built end to end by a real worker. Each of its requirements traces to a design, a journey, a test and a merged pull request.

Ledgerline shows the gaps. L2 zero two zero has designs and a journey but no test, so it is marked. L2 zero three one is deferred, so its empty test column is not needed. And searching narrows the list, or says what range the project has.

As a Viewer the trace reads the same in dark mode, and on a phone.

Before stage five there are no requirements yet, while an L2 file that can't be parsed names the commit and line, and the repository is left unchanged.

## Recap

Journey seventeen is complete. Every L2 traces to its L1, designs, journeys, tests and pull requests, read straight from the repository at its head. A requirement with no test stands out, unless it is deferred. And the trace stays current as stages and increments finish. Next comes journey eighteen.
