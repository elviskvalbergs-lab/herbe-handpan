# Moving the repository from GitHub to Bitbucket Cloud

Checked on **2026-11-21**. Nothing in the session that wrote this could reach Bitbucket itself, so this is a plan, not a record of something done. Every statement about Bitbucket, Vercel, Sentry, Playwright or Claude Code has the documentation page it came from next to it. Where the documentation didn't answer, it says **not verified**: check those in the console before relying on them.

The steps are in the order that avoids downtime. The short version is the checklist in section 12.

---

## 0 · Read this first: four things that decide whether to move

1. **Claude Code cloud sessions only work with GitHub.** "Repository cloning in Anthropic-hosted environments and pull request creation require GitHub." A Bitbucket repository can be sent to a cloud session as a local bundle, "but the session can't push results back to that remote" ([Claude Code: cloud sessions, Limitations](https://code.claude.com/docs/en/claude-code-on-the-web#limitations)). After the move, Claude Code on the web can no longer clone this repository, push branches or open pull requests the way it does now. Section 8 has the fallbacks.
2. **Bitbucket's Free plan has 50 build minutes a month** ([Limitations of Bitbucket Pipelines](https://support.atlassian.com/bitbucket-cloud/docs/limitations-of-bitbucket-pipelines/)). One run of `scripts/ci.sh` takes several minutes, and every pull request update runs it. Fifty minutes is roughly a dozen runs. Standard has 2,500 minutes a month.
3. **Blocking a merge when checks fail needs Bitbucket Premium.** On Free and Standard, merge checks only warn (section 5).
4. **A private Bitbucket repository cannot deploy to a Vercel Hobby team.** "You cannot deploy to a Hobby team from a private repository in a GitHub organization, GitLab group, or Bitbucket workspace" ([Vercel: Deploying private Git repositories](https://vercel.com/docs/git#using-hobby-teams)). Today the GitHub repository is **public** and belongs to a personal account (checked with the GitHub API on 2026-11-21). Either keep it public on Bitbucket, or put the Vercel projects on a Pro team. Which plan the Vercel team is on: not verified (the Vercel API didn't return it); see Vercel → team Settings → Billing.

## 1 · What the repository looks like today

Checked on 2026-11-21 with `git ls-remote` and the GitHub API:

| What | Value |
| --- | --- |
| Repository | `github.com/elviskvalbergs-lab/herbe-handpan`, public, owned by a personal account |
| Default branch | `preview` (there is no `main` or `master`) |
| Branches | 84 |
| Tags | 0 |
| Git LFS | not used (no `.gitattributes`) |
| Pull request refs (`refs/pull/*`) | 83 |
| Open pull requests | #80 (`songs-polish` → `preview`) and #81 (`claude/bold-maxwell-1ooc6u` → `preview`) |
| Size of `.git` | about 10 MB |
| Vercel projects | `herbe-handpan` (the app, repository root; domains `handpan.herbe.app`, `oakhum.vercel.app`) and `oakhum-site` (the website, root directory `site`; domains `oakhum.com`, `www.oakhum.com`) |

**Write down before you start** (not verified from here): the production branch of each Vercel project (Project → Settings → Environments → Production → Branch Tracking, per [Vercel: Production branch](https://vercel.com/docs/git#production-branch)) and the Root Directory of `oakhum-site` (`site`).

## 2 · Create the workspace, project and repository on Bitbucket

Owner, in the Bitbucket web console.

1. Create a workspace (or use one you have). The exact steps: not verified (Atlassian's "create a workspace" page returned 404 on 2026-11-21).
2. Create a project in the workspace and a repository in it: **Create → Repository** ([Create a Git repository](https://support.atlassian.com/bitbucket-cloud/docs/create-a-git-repository/)).
   - **Access level:** the "This is a private repository" box is ticked by default. Decide this with point 4 of section 0 in mind.
   - **Include a README?** No. The repository must be empty, or the push in section 3 is rejected.
   - Name it `herbe-handpan` so paths in notes and scripts stay the same.
3. In **Personal Bitbucket settings → Email aliases**, add the email your commits carry (`git config user.email`) and confirm it through the link Bitbucket sends. "Until you confirm that email address, Bitbucket can't display your account name with your commits properly" ([Set email aliases](https://support.atlassian.com/bitbucket-cloud/docs/set-email-aliases/)). Vercel depends on this (section 4).

Bitbucket also has an importer: **Create → Repository → Import repository**, with the GitHub URL and, for a private source, a username and password or access token ([Import a repository](https://support.atlassian.com/bitbucket-cloud/docs/import-a-repository/)). The page says it "grabs a repository" and does not say that pull requests, issues, comments or the wiki come with it. Treat it as code only (not verified beyond that). The manual push below does the same job and lets you check the result, so use that.

## 3 · Copy the code: all branches and tags, full history

On your machine. This only reads from GitHub.

```bash
git clone --mirror https://github.com/elviskvalbergs-lab/herbe-handpan.git herbe-handpan.git
cd herbe-handpan.git

# What the mirror holds. Expect refs/heads (84) and refs/pull (83); no tags today.
git for-each-ref --format='%(refname)' | sed -E 's#^(refs/[^/]+)/.*#\1#' | sort | uniq -c

git remote add bitbucket git@bitbucket.org:<workspace>/herbe-handpan.git

# Branches and tags only. Do not use `git push --mirror` here.
git push bitbucket 'refs/heads/*:refs/heads/*' 'refs/tags/*:refs/tags/*'

# Check that both sides have the same branches and tags at the same commits.
diff <(git ls-remote origin    'refs/heads/*' 'refs/tags/*') \
     <(git ls-remote bitbucket 'refs/heads/*' 'refs/tags/*') && echo identical
```

Why not `git push --mirror`: a mirror clone of GitHub also holds `refs/pull/<n>/head` (and `/merge`), GitHub's own record of each pull request. They are not branches, Bitbucket doesn't use them, and `--mirror` would try to push all 83. Whether Bitbucket Cloud rejects them or stores them as stray refs: not verified. Bitbucket Data Center is documented to refuse pushes to its own pull request refs ([Atlassian KB](https://support.atlassian.com/bitbucket-data-center/kb/pullrequestrefguardhook-vetoed-the-push-request-message-seen-in-bitbucket-server-logs/)). Pushing with the two explicit refspecs sidesteps the question. The commands above were tried on 2026-11-21 against scratch repositories with a `refs/pull` ref present: only branches and tags went across.

If you prefer `--mirror`, delete the pull refs from the local mirror first:

```bash
git for-each-ref --format='delete %(refname)' refs/pull | git update-ref --stdin
git push --mirror bitbucket
```

Notes:

- GitHub's own instructions for copying a repository are `git clone --bare` followed by `git push --mirror`, plus `git lfs fetch --all` and `git lfs push --all` when LFS is used ([GitHub: Duplicating a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/duplicating-a-repository)). This repository has no LFS files, so those two steps are not needed.
- This push will not start any pipelines, even once Pipelines is on: "we don't run any pipelines for pushes that involve more than five tags, bookmarks, or branches" ([Limitations of Bitbucket Pipelines](https://support.atlassian.com/bitbucket-cloud/docs/limitations-of-bitbucket-pipelines/)).
- After the push, check that the repository's main branch in Bitbucket is `preview` (Repository settings → Repository details; exact field name not verified). Vercel uses it when picking a production branch for a new project (section 4).
- **While GitHub is still the place people merge**, re-run the copy whenever you want Bitbucket caught up:
  ```bash
  git fetch --prune origin
  git push --prune bitbucket 'refs/heads/*:refs/heads/*' 'refs/tags/*:refs/tags/*'
  ```
  Stop doing this the moment anything is pushed or merged on Bitbucket (section 9, step 5): `--prune` deletes Bitbucket branches that GitHub doesn't have.

## 4 · Vercel: two projects, one Bitbucket repository

### How Vercel's Bitbucket integration works

- Bitbucket Free, Standard and Premium are supported ([Vercel for Bitbucket](https://vercel.com/docs/git/vercel-for-bitbucket)).
- "Vercel for Bitbucket will deploy each push by default. This includes pushes and pull requests made to branches." The latest push to a pull request gets a preview URL, and "these URLs will be given through a comment on each pull request" (same page).
- To connect a repository, you need **Admin** access to it on Bitbucket, "so that we can configure a webhook and automatically deploy pushed commits" (same page, "Missing Git repository").
- A project is moved to another repository in **Project → Settings → Git**: "If you'd like to connect your Vercel Project to a different Bitbucket repository or disconnect it, you can do so from the Git section in the Project Settings" (same page).
- The build gets the same `VERCEL_GIT_*` variables as on GitHub, including `VERCEL_GIT_COMMIT_SHA`; `VERCEL_GIT_PROVIDER` becomes `bitbucket` (same page). `build.py` uses `VERCEL_GIT_COMMIT_SHA` for the Sentry release name, so that keeps working.
- Whether Vercel reports a build status to Bitbucket that the "successful builds" merge check counts: not verified. The page only describes pull request comments.

### Who may trigger a deployment (the commit-author rule)

What the documentation says ([Vercel: Deploying private Git repositories](https://vercel.com/docs/git#deploying-private-git-repositories), [Troubleshoot project collaboration](https://vercel.com/docs/deployments/troubleshoot-project-collaboration)):

- The rule is about **private** repositories: commits "will only be deployed if the commit author also has access to the respective project on Vercel". It "only applies to commit authors on GitHub organizations, GitLab groups and non-personal Bitbucket workspaces". Which Bitbucket workspaces Vercel counts as personal: not verified.
- **Hobby team:** "the commit author must be the owner of the Hobby team", checked through the owner's **Login Connections**. And a Hobby team cannot deploy from a private repository in a Bitbucket workspace at all (section 0, point 4).
- **Pro team:** "the commit author must be a member of the team". Vercel finds the member through Login Connections. An author with a Vercel account who isn't a member is added automatically (a paid seat) or waits for approval, depending on the team's collaboration settings ([Vercel: Collaboration settings](https://vercel.com/docs/accounts#collaboration-settings)). An author with no linked Vercel account: "the deployment fails regardless of which approval mode is enabled".
- How the author is recognised: "Your git provider associates commits with users by matching the commit email to an email on your git provider account." If the Vercel account isn't connected to the Git provider, Vercel falls back to its own email list: "make sure you've properly configured your Vercel email address so that it matches the email associated with the commit."
- For a **public** repository these rules don't apply; only pull requests from forks need authorising ([Vercel: Deploying forks of public Git repositories](https://vercel.com/docs/git#deploying-forks-of-public-git-repositories)).

What the owner must do, whatever the plan and visibility:

1. In Vercel → account **Settings → Authentication → Login Connections**, connect your **Bitbucket** account ([Vercel: Connecting Git provider accounts](https://vercel.com/docs/deployments/troubleshoot-project-collaboration#connecting-git-provider-accounts)). A Hobby team "can have only one login connection per third-party service" ([Vercel: Account Management](https://vercel.com/docs/accounts#using-an-existing-login-connection)), so it must be the Bitbucket account that owns the commits.
2. Make every commit carry an email that is (a) a confirmed email or alias on that Bitbucket account (section 2, step 3) and (b) one of the verified emails on the Vercel account (Account Settings → Emails; up to three, per [Vercel: Managing emails](https://vercel.com/docs/accounts#managing-emails)). The simplest way is to keep the email the commits carry today and add it in both places.
3. Commits made by tools (Claude Code, a bot) must use that same name and email, as they do now.

So the rule in `CLAUDE.md` stays, with new wording (section 7). Note that the documented rule covers private repositories, while `CLAUDE.md` records that Vercel blocked other authors on this repository; keep the rule either way, it costs nothing.

### What to do per project

Do this for `herbe-handpan` (the app) and for `oakhum-site` (the website), in the order section 9 gives.

1. Project → **Settings → Git** → disconnect the GitHub repository, connect the Bitbucket one. From that moment pushes to GitHub no longer deploy this project. The live production deployment is not touched by this (it stays until a new production deployment replaces it; not verified in the documentation, but a disconnect creates no deployment).
2. Check **Root Directory** (Build and Deployment settings): empty for the app, `site` for the website, with "Include files outside the root directory" on, because the website reads `../js`, `../css`, `../fonts` and `../brand` (`site/README.md`). Whether a reconnect keeps it: not verified, so look.
3. Check the **production branch** (Settings → Environments → Production → Branch Tracking) against what you wrote down in section 1. For a new project Vercel picks `main`, then `master`, then "[Only for Bitbucket]: … the "production branch" setting of your Git repository", then the default branch ([Vercel: Production branch](https://vercel.com/docs/git#production-branch)). This repository has neither `main` nor `master`.
4. **Environment variables, domains and Deployment Protection belong to the Vercel project**, not to the Git connection, so `DATABASE_URL`, `HP_SUPABASE_URL`, `HP_SUPABASE_KEY`, the Sanity variables and the Jira variables stay where they are. Look at the list once after reconnecting (not verified in the documentation that nothing is reset).
5. Pull request comments from Vercel can be switched off per project under Settings → Git ([Vercel for Bitbucket: Silence comments](https://vercel.com/docs/git/vercel-for-bitbucket#silence-comments)).

## 5 · Branch restrictions and merge checks on `preview`

Owner, in Bitbucket: the repository's **Settings → Workflow → Branch restrictions** ([Use branch permissions](https://support.atlassian.com/bitbucket-cloud/docs/use-branch-permissions/)). Add a restriction for `preview`, and one for the production branch if it is a different branch.

| Rule from `CLAUDE.md` | Setting | Plan |
| --- | --- | --- |
| Never push to `preview` directly | **Write access**: "Only specific people or groups have write access", with nobody (or only yourself for emergencies) in the list | Whether branch restrictions are on the Free plan: not verified (the page doesn't say) |
| Merge by pull request only | **Merge access via pull requests**: who may merge. The page's example is "Allow everyone to merge to develop but only through a pull request" | same |
| No deleting, no rewriting history | The delete and rewrite-history options of the same restriction | same |
| Passing builds before a merge | Merge check "Minimum number of successful builds for the last commit with no failed builds and no in progress builds" | The check exists on every plan, but only warns without Premium |
| Approvals before a merge | Merge checks "Minimum number of approvals" and "Minimum number of approvals from default reviewers" | same |

The plan limit, in Atlassian's words ([Suggest or require checks before a merge](https://support.atlassian.com/bitbucket-cloud/docs/suggest-or-require-checks-before-a-merge/)): "we'll warn users when they have unresolved merge checks, but they'll still be able to merge." and "To prevent users from merging, upgrade to Premium and select Prevent a merge with unresolved merge checks." Premium-only on that page: "Prevent a merge with unresolved merge checks", "Reset approvals when the source branch is modified" and "Keep approvals if there is no change to the diff in the pull request". The pricing page lists "enforced merge checks" under Premium; on 2026-11-21 it showed Free at $0 for up to 5 users, Standard at $3.65 and Premium at $8 per user a month ([Bitbucket pricing](https://www.atlassian.com/software/bitbucket/pricing)).

With one person merging, a warning may be enough: the rule "never merge pull requests yourself" in `CLAUDE.md` already keeps Claude from merging. A required approval with a single account in the workspace would block every merge, so set approvals to 0 unless a second reviewer exists.

## 6 · Pipelines

1. **Turn it on:** "In Bitbucket, go to your repository and select Pipelines" ([Configure your first pipeline](https://support.atlassian.com/bitbucket-cloud/docs/configure-your-first-pipeline/)). The file is already in the repository: "A pipeline is defined using a YAML file called `bitbucket-pipelines.yml`, which is located at the root of your repository" ([Get started with Bitbucket Pipelines](https://support.atlassian.com/bitbucket-cloud/docs/get-started-with-bitbucket-pipelines/)). Whether there is a separate "Enable Pipelines" switch under Repository settings and who may flip it: not verified.
2. **Build minutes** ([Limitations of Bitbucket Pipelines](https://support.atlassian.com/bitbucket-cloud/docs/limitations-of-bitbucket-pipelines/)): Free 50 a month, Standard 2,500, Premium 3,500. A step larger than `1x` uses minutes faster, and sizes `4x` and up need a paid plan ([Step options: Size](https://support.atlassian.com/bitbucket-cloud/docs/step-options/)). What happens when the Free minutes run out: not verified from the documentation (a search summary said pipelines stop for the rest of the month).
3. **When it runs** ([Pipeline start conditions](https://support.atlassian.com/bitbucket-cloud/docs/pipeline-start-conditions/)):
   - `pull-requests: '**'` runs for a pull request from any branch. The page describes it as running "when a pull request is created"; that it also runs on each later push to the pull request's branch is not verified from the page.
   - "It merges the destination branch into your working branch before it runs." and "If the merge fails, the pipeline stops." So a pull request that conflicts with `preview` fails before any test runs.
   - "Pull requests from a forked repository don't trigger the pipeline."
   - "Pull request pipelines run in addition to any branch and default pipelines that are defined, so if the definitions overlap you may get 2 pipelines running at the same time." The file has `branches: preview` only, so a feature branch runs once (as a pull request) and `preview` runs once after each merge. A pull request whose source branch is `preview` (for example into a production branch) would run twice.
4. **Variables:** none are needed. The checks run without `DATABASE_URL`, and it must not be added here. If one is ever needed: Repository settings → Pipelines → Repository variables ([Variables and secrets](https://support.atlassian.com/bitbucket-cloud/docs/variables-and-secrets/)).
5. **Make it count:** once a pull request has shown a green pipeline, add the "successful builds" merge check from section 5.

## 7 · Changes in the repository (one pull request, after cut-over)

These can be done by Claude or by hand, in a pull request into `preview`:

- **`CLAUDE.md`, "Commits":** replace "Commits must be authored by the GitHub account elviskvalbergs-lab, because Vercel blocks deployments from other commit authors" with wording that names the Bitbucket account and the email, for example: "Commits must carry the name and email of the owner's Bitbucket account (the one connected to Vercel under Login Connections), because Vercel only deploys commits whose author it can match to the owner." Keep the `git config user.name` / `user.email` check.
- **`CLAUDE.md`, "Branches and pull requests":** say that pull requests are opened on Bitbucket, and how (section 8).
- **`.github/workflows/ci.yml`:** delete it once a Bitbucket pipeline has passed on a pull request. Until then it is harmless: Bitbucket ignores `.github/`.
- **`scripts/ci.sh` and `bitbucket-pipelines.yml`:** their opening comments mention GitHub Actions; update them when the workflow file goes.
- **`docs/free-to-play.md` line 94:** the link to GitHub pull request #14. It keeps working while the GitHub repository exists (archived is fine); reword it or leave it.
- **`supabase/README.md` and `site/README.md`:** they say "merge the next PR" and "Vercel → Add New → Project → this repository" without naming GitHub; nothing to change.

## 8 · Integrations

| Integration | What happens | What to do |
| --- | --- | --- |
| **Claude Code on the web (cloud sessions), Claude GitHub App** | Stops working for this repository. "Repository cloning in Anthropic-hosted environments and pull request creation require GitHub." Auto-fix "requires the Claude GitHub App", and Code Review is for GitHub pull requests ([cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web#limitations), [docs index](https://code.claude.com/docs/llms.txt): pages for GitHub Actions and GitLab CI/CD, none for Bitbucket) | See below |
| **Sentry** | Sentry has a Bitbucket integration: commit tracking and stack trace linking; creating Bitbucket issues from Sentry "is only supported on legacy Bitbucket instances" ([Sentry: Bitbucket](https://docs.sentry.io/organization/integrations/source-code-mgmt/bitbucket/)). Error reporting itself doesn't depend on the Git host: the app's release name comes from `VERCEL_GIT_COMMIT_SHA` in `build.py`, which Vercel still sets | If the Sentry organisation has the GitHub integration installed (not verified from here): Sentry → Settings → Integrations → Bitbucket, install, add the repository, then remove the GitHub one. Needs "Sentry owner, manager, or admin permissions, and Bitbucket admin permissions" |
| **Supabase** | Nothing to move. This project doesn't use Supabase's GitHub integration: migrations are applied by `build.py` → `supabase/migrate.py` during the Vercel build, using `DATABASE_URL` from Vercel's environment variables (`supabase/README.md`) | Nothing |
| **Sanity** | Nothing to move. Sanity is connected to the Vercel project through Vercel's Marketplace and its environment variables (`site/README.md`); the site's code has no Git-host webhook | Nothing. If a Sanity deploy hook exists, it is a Vercel URL and stays valid (existence not verified) |
| **PostHog** | No Git integration | Nothing |
| **Jira feedback** (`JIRA_*` variables on the site) | Vercel environment variables, not tied to the Git host | Nothing |

### Claude Code after the move

Honest summary: the way this repository is worked on today (a cloud session clones from GitHub, pushes a branch, opens a pull request into `preview`) has no Bitbucket equivalent. The options, from the documentation:

1. **Run Claude Code locally** (terminal or desktop app) in a checkout whose remote is Bitbucket. It uses your own Git credentials, so it can push branches. Pull requests are then opened in Bitbucket's web console or through Bitbucket's API; Claude Code has no built-in Bitbucket pull request tool (none is documented).
2. **Send the local repository to a cloud session as a bundle:** `CCR_FORCE_BUNDLE=1 claude --cloud "…"`. The session gets the code, "but the session can't push results back to that remote" ([cloud sessions: Send local repositories without GitHub](https://code.claude.com/docs/en/claude-code-on-the-web#send-local-repositories-without-github)). You would pull the session into your terminal with `claude --teleport` and push from there.
3. **Run Claude Code inside Pipelines**, non-interactively: `claude -p "…"` with `ANTHROPIC_API_KEY` as a secured repository variable ([Run Claude Code programmatically](https://code.claude.com/docs/en/headless)). This costs build minutes and API usage, and there is no ready-made Bitbucket setup in the documentation.
4. **Keep GitHub as the place Claude works** and mirror it to Bitbucket (section 3's catch-up commands, one direction only). Then pull requests and reviews stay on GitHub and Bitbucket is a copy, which is not really a move. Listed because it is the only option that keeps cloud sessions, auto-fix and the GitHub tools.

## 9 · Cut-over order, and rollback

Nothing here takes the site or the app down: production keeps serving its current deployment until a new production deployment replaces it.

1. **Prepare on Bitbucket** (sections 2 and 3): repository, email alias, first copy of the code. GitHub stays the place where work happens.
2. **Connect your Bitbucket account in Vercel** (section 4, Login Connections and emails).
3. **Prove the path with a throwaway Vercel project.** A Vercel project connects to one repository, so the real projects cannot follow GitHub and Bitbucket at once. Create a new project from the Bitbucket repository (root directory empty, no domains, no environment variables). Without `DATABASE_URL` the build skips migrations (`supabase/README.md`). Push a test branch to Bitbucket and check that a deployment is created and not blocked for its commit author. Optionally do the same with root directory `site`: without Sanity variables the site builds with its starting content (`site/README.md`). Delete the throwaway project(s) afterwards.
4. **Turn on Pipelines** (section 6), open a test pull request on Bitbucket from the test branch, and see the pipeline pass. Decline the pull request.
5. **Freeze GitHub.** Merge or park what is open, run the catch-up copy from section 3 one last time, and from now on push only to Bitbucket. Point your local checkout at Bitbucket: `git remote set-url origin git@bitbucket.org:<workspace>/herbe-handpan.git`.
6. **Re-open the open pull requests on Bitbucket** (section 11).
7. **Switch the website project** (`oakhum-site`) to Bitbucket (section 4, "What to do per project"). Push a branch, check the preview deployment, then merge a small pull request and check that production (`oakhum.com`) deploys.
8. **Switch the app project** (`herbe-handpan`) the same way. It goes second because its production build runs the database migrations. Check the build log for the `[migrate]` lines and that `handpan.herbe.app` and `/play` on `oakhum.com` work.
9. **Branch restrictions and merge checks** (section 5).
10. **Repository clean-up pull request** (section 7), **Sentry** (section 8).
11. **Archive the GitHub repository.** Archiving makes it "read-only for all users", including its issues, pull requests and comments, and it can be unarchived ([GitHub: Archiving repositories](https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories)). Do this last, after a week or so without problems. Don't delete it: the pull request history (#1 to #81) and their discussions only exist there.

**Rollback**, at any point before step 11:

- A bad production deployment: use Vercel's instant rollback to the previous production deployment (reverting a commit also restores the previous deployment, per [Vercel for Bitbucket: Updating the Production Domain](https://vercel.com/docs/git/vercel-for-bitbucket#updating-the-production-domain)).
- Bitbucket deployments don't work: in each Vercel project, Settings → Git → disconnect Bitbucket, connect the GitHub repository again, check root directory and production branch. If commits were already made on Bitbucket, push them to GitHub first (`git push github 'refs/heads/*:refs/heads/*'` from a clone of Bitbucket) so GitHub is not behind.
- Database migrations are additive and recorded in `public._hp_migrations`, so a build from either host applies each file once; switching back does not re-run or undo anything.
- After step 11: unarchive the GitHub repository, then as above.

## 10 · What breaks or changes

- **Pull request numbers.** Bitbucket starts again at #1. Merge commits in the history say "Merge pull request #78 from elviskvalbergs-lab/…"; those numbers mean GitHub pull requests. `docs/free-to-play.md` line 94 links to GitHub pull request #14.
- **GitHub Actions checks.** `.github/workflows/ci.yml` does nothing on Bitbucket. Bitbucket Pipelines replaces it with the same script. There is no status badge in the repository to update.
- **Vercel on pull requests.** On Bitbucket, Vercel posts the preview URL as a pull request comment. GitHub's deployment entries and checks have no documented Bitbucket counterpart (not verified).
- **Claude Code cloud sessions, auto-fix, Code Review, the GitHub tools in sessions** (section 8).
- **`github.com` in the repository** (searched on 2026-11-21, lockfile excluded):
  - `docs/free-to-play.md:94`: link to this repository's pull request #14. Affected.
  - `fonts/README.md:11`: link to Google Fonts' licence file. Not affected.
  - `scripts/demo-video/voiceover.py:33`: download URL of a speech model. Not affected.
  - `site/.gitignore:1`: a comment with a GitHub help link. Not affected.
  - Mentions of GitHub without a URL: `CLAUDE.md` ("GitHub account elviskvalbergs-lab"), `scripts/ci.sh` and `bitbucket-pipelines.yml` (comments), `.github/workflows/ci.yml` (the workflow itself).
- **Links in old Vercel deployments, Sentry issues and Jira tickets** that point at GitHub commits keep working as long as the GitHub repository exists.

## 11 · The open pull requests

A push copies branches, not pull requests, and Bitbucket's importer is not documented to bring them either (section 2). Both branches of the two open pull requests arrive with the copy in section 3. For each one, on Bitbucket: **Create pull request**, source branch as below, destination `preview`, and paste the title and description from GitHub with a link back to the original for its discussion.

| GitHub | Source branch | Title |
| --- | --- | --- |
| #80 | `songs-polish` | One kind of list (Playlists), played on any instrument that has the chords; back to the start everywhere; song filters with a Christmas spotlight |
| #81 | `claude/bold-maxwell-1ooc6u` | Review fixes: link injection, build checks, exposed repo files, CI |

Review comments stay on GitHub. The cheaper route is to merge both on GitHub before step 5 of section 9, so nothing needs re-opening.

## 12 · Checklist

### Owner, in a web console

Bitbucket:

- [ ] Decide: public or private repository; Free, Standard or Premium (section 0)
- [ ] Workspace, project and empty repository `herbe-handpan` (no README)
- [ ] Email alias added and confirmed for the commit email
- [ ] Main branch is `preview` after the first push
- [ ] Pipelines turned on; a test pull request shows a green pipeline
- [ ] Branch restriction on `preview` (and the production branch): no direct pushes, merge by pull request, no delete, no history rewrite
- [ ] Merge checks: successful builds; approvals only if a second reviewer exists
- [ ] Open pull requests #80 and #81 re-opened (or merged on GitHub first)

Vercel:

- [ ] Production branch and root directory of both projects written down
- [ ] Bitbucket connected under account Settings → Authentication → Login Connections
- [ ] Commit email present under Account Settings → Emails
- [ ] Throwaway project from the Bitbucket repository deploys a test branch; then deleted
- [ ] `oakhum-site`: Git switched to Bitbucket; root directory `site`; production branch; environment variables still there; preview and production deploy
- [ ] `herbe-handpan`: the same, root directory empty; `[migrate]` lines in the production build log

Elsewhere:

- [ ] Sentry: Bitbucket integration installed and repository added, if the GitHub integration was in use
- [ ] Claude Code: decide how work continues (section 8) and set it up
- [ ] GitHub: repository archived (last, after a quiet week)

### On your machine (owner, or Claude Code running locally with your credentials)

- [ ] Mirror clone and push of branches and tags; `identical` printed (section 3)
- [ ] Final catch-up copy before the freeze
- [ ] `git remote set-url origin …` in working checkouts

### In a pull request

- [ ] `CLAUDE.md`: commit-author rule and pull request wording (section 7)
- [ ] `.github/workflows/ci.yml` removed once Pipelines is the gate
- [ ] Comments in `scripts/ci.sh` and `bitbucket-pipelines.yml` updated
- [ ] `docs/free-to-play.md` line 94 reworded or left as is
- [ ] The first Pipelines run shows the browser tests installing Chromium and passing (`scripts/e2e.sh`, section 13); if `--with-deps` fails on `node:22`, that script is the one place to fix

## 13 · `bitbucket-pipelines.yml`: what was checked on 2026-11-21

| Point | Result | Source |
| --- | --- | --- |
| Top-level `image: node:22` | Valid. Public images are given by name at the top level; without one Pipelines uses `atlassian/default-image:latest` | [Use Docker images as build environments](https://support.atlassian.com/bitbucket-cloud/docs/use-docker-images-as-build-environments/) |
| `definitions: steps:` with `- step: &checks`, reused as `- step: *checks` | Valid, this is the documented form. Anchor names must not contain `[ ] { } ,` | [YAML anchors](https://support.atlassian.com/bitbucket-cloud/docs/yaml-anchors/) |
| `pull-requests: '**'` and `branches: preview` | Valid. Behaviour as in section 6 | [Pipeline start conditions](https://support.atlassian.com/bitbucket-cloud/docs/pipeline-start-conditions/) |
| `caches: [node]` | **Changed.** The predefined `node` cache is the directory `node_modules`, relative to the clone directory; this repository has no root `node_modules` (the website's is `site/node_modules`, filled by pnpm), so it cached nothing. Replaced by a custom cache `pnpm-store` with `key: files: site/pnpm-lock.yaml` and `path: ~/.pnpm-store`. "Pre-defined caches don't support file-based cache keys"; cache paths "can be absolute, or relative to the clone directory"; a cache older than a week is cleared; only caches under 1 GB compressed are saved | [Cache dependencies](https://support.atlassian.com/bitbucket-cloud/docs/cache-dependencies/) |
| Pointing pnpm at that directory | The script line is now `pnpm_config_store_dir="$HOME/.pnpm-store" scripts/ci.sh`. That pnpm 11.9.0 (the version in `site/package.json`) reads this variable was checked by running `pnpm store path` with it set; pnpm's page only says settings come from "the command line, environment variables, and `pnpm-workspace.yaml`". pnpm's own Bitbucket example sets the store with `pnpm config set store-dir` and caches that directory | [pnpm settings](https://pnpm.io/settings), [pnpm: Continuous Integration](https://pnpm.io/continuous-integration) |
| Step time limit | **Added `max-time: 20`.** The default is 120 minutes (allowed 1 to 720); a stuck step would use more than two months of Free build minutes | [Step options: Max-time](https://support.atlassian.com/bitbucket-cloud/docs/step-options/) |
| Step size | Left at the default `1x`: 4 GB of memory and 64 GB of disk | [Step options: Size](https://support.atlassian.com/bitbucket-cloud/docs/step-options/) |
| `scripts/ci.sh` executable | Git stores it with mode `100755` (`git ls-files -s scripts/ci.sh`), which a clone keeps, so calling it directly works. Bitbucket's pages don't mention file modes: not verified by a run | — |
| `python3` in `node:22` | The image is built on `buildpack-deps:bookworm` (Debian 12), which installs Mercurial and with it Python 3, but no page promises that. The `apt-get install -y python3` line stays; it does nothing if Python is there. Debian 12's Python is 3.11 (the GitHub workflow uses 3.12): `build.py` and `supabase/migrate.py` were parsed with Python 3.11 on 2026-11-21 without errors. Not verified by running the image (no Docker in the session) | [node image Dockerfile](https://github.com/nodejs/docker-node/blob/main/22/bookworm/Dockerfile), [buildpack-deps](https://github.com/docker-library/buildpack-deps/blob/master/debian/bookworm/scm/Dockerfile) |
| corepack and pnpm in `node:22` | Node 22 ships corepack, and `scripts/ci.sh` runs `corepack enable`; checked with Node 22.23.5 outside Docker, where it provides pnpm 11.9.0. pnpm's CI page now advises against corepack ("It runs pnpm through a Node.js shim on every call"); this is a speed remark, not a fault | [pnpm: Continuous Integration](https://pnpm.io/continuous-integration) |
| The file as a whole | Parses as YAML and both pipelines resolve to the same step (checked with a YAML parser). Not run on Bitbucket | — |

### Playwright for the browser smoke suite

Another change adds `node tests/e2e/smoke.e2e.mjs` to `scripts/ci.sh`; it loads `playwright` with `require` and starts Chromium. What the documentation says:

- The official image is `mcr.microsoft.com/playwright:v1.64.1-noble` (current on 2026-11-21). It holds the browsers and their system packages, but "the Playwright package/dependency is not included in the image", and the image tag must match the package version or "Playwright will be unable to locate browser executables" ([Playwright: Docker](https://playwright.dev/docs/docker)).
- That image's Dockerfile installs **Node 24** (Node 26 on the development branch) and no Python ([Dockerfile.noble at v1.64.1](https://github.com/microsoft/playwright/blob/v1.64.1/utils/docker/Dockerfile.noble)). The checks here need Node 22 and Python 3, and Node 25 and later no longer include corepack, which `scripts/ci.sh` uses (corepack's removal: not verified from Node's documentation).
- Playwright supports "Node.js: latest 22.x, 24.x or 26.x" on "Debian 12 / 13, Ubuntu 22.04 / 24.04 / 26.04" ([Playwright: Installation](https://playwright.dev/docs/intro)), and installs one browser with its system packages through `npx playwright install --with-deps chromium`; browsers go to `~/.cache/ms-playwright` ([Playwright: Browsers](https://playwright.dev/docs/browsers)).

So keep `image: node:22` and install Chromium in the step. That is what `scripts/e2e.sh` (called by `scripts/ci.sh`) does by itself: where `require('playwright')` does not resolve, it installs the pinned version (`PLAYWRIGHT_VERSION` in that script, one place for both CI systems) into `~/.cache/oakhum-e2e`, outside the repository, and runs `playwright install --with-deps chromium`. So `bitbucket-pipelines.yml` needs no Playwright lines of its own, and neither does the GitHub workflow. The install path was run in a clean environment on 2026-11-21 (Ubuntu 24.04, as root); it has not been run on Bitbucket's `node:22` (Debian 12), which Playwright lists as supported. The download of Chromium and its packages adds time to every run, which matters with 50 build minutes a month.
