Delete local branches that are fully merged, keeping protected branches (master/main/dev/staging):

```bash
git branch --merged | grep -Ev "(^\\*|^\\+|master|main|dev|staging)" | xargs --no-run-if-empty git branch -d
```
