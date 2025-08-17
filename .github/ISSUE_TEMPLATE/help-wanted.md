---
name: Help wanted
about: 'Please help: I have trouble setting this up.'
title: ''
labels: ''
assignees: ''

---

Before posting an issue, please take a few minutes to search the docs and old issues.
(Don't hesitate to ask though, no need to spend your whole evening 😁)

Please include as much of the details below as you can:
- What have you tried to get it working?
- Where do you get stuck?
- Maybe you already have a gut-feeling what might be the problem?

---

**beets-flask config**
```yaml
# paste config here
```

**beets config**
```yaml
# paste config here, remove sensitive information like login data
```

**Docker-compose file / Docker command**
```yaml
# paste here, in particular volume mounts
```

**Container logs**
Find the output from `docker logs beets-flask` below:
```
> docker logs beets-flask
[Entrypoint] Running as 'beetle' with UID 1000 and GID 1002
[Entrypoint] Current working directory: /repo
[Entrypoint] Version info:
[Entrypoint]   Backend:  1.1.1
[Entrypoint]   Frontend: 1.1.1
[Entrypoint]   Mode:     prod
INFO:     Uvicorn running on http://0.0.0.0:5001 (Press CTRL+C to quit)
...
```
