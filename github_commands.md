# GitHub CLI (gh) Commands Reference

This document lists essential `gh` commands for managing authentication, repositories, and codespaces in this project.

## Authentication
Use these commands to manage your GitHub identity.

- **Check auth status**: `gh auth status`
- **Login via browser**: `gh auth login`
- **Login via token**: `echo $YOUR_TOKEN | gh auth login --with-token`
- **Logout**: `gh auth logout`
- **Refresh credentials**: `gh auth refresh`

## Repository Management
- **Clone a repository**: `gh repo clone <owner>/<repo>`
- **View current repo**: `gh repo view`
- **List your repositories**: `gh repo list`
- **Create a new repository**: `gh repo create <name> --public/--private`
- **Fork a repository**: `gh repo fork <owner>/<repo>`

## Codespaces
As used in `orchestrate_codespaces.js` for automation.

- **List codespaces**: `gh codespace list`
- **Create a codespace**: 
  ```bash
  gh codespace create --repo <owner>/<repo> --machine standardLinux32gb --idle-timeout 240m
  ```
- **Copy files to a codespace**: `gh codespace cp <local-path> <codespace-name>:<remote-path>`
- **Execute command via SSH**: `gh codespace ssh -c "<command>" -e <codespace-name>`
- **Delete a codespace**: `gh codespace delete -c <codespace-name>`
- **Stop a codespace**: `gh codespace stop -c <codespace-name>`

## Secrets and Variables
Manage repository secrets (useful for API keys and tokens).

- **List secrets**: `gh secret list`
- **Set a secret**: `gh secret set <SECRET_NAME> --body "<value>"`
- **Delete a secret**: `gh secret delete <SECRET_NAME>`
- **Set a variable**: `gh variable set <VAR_NAME> --body "<value>"`

## Gists
- **Create a gist**: `gh gist create <file>`
- **List your gists**: `gh gist list`

## Environment Variables
The `gh` CLI also respects these environment variables:
- `GH_TOKEN` / `GITHUB_TOKEN`: Use for authentication without `gh auth login`.
- `GH_REPO`: Specify the target repository.

---
*Generated for the GitHub-RDP project.*
