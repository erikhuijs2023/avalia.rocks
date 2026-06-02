FROM node:22-alpine

# git for the repo clone/pull, rsync for atomic dist -> html sync.
RUN apk add --no-cache git rsync

WORKDIR /app

# No runtime npm deps — the builder is a vanilla node:http server.
COPY package.json ./

COPY index.mjs entrypoint.sh ./
RUN chmod +x entrypoint.sh

# REPO_DIR holds the git clone of the Avalia.Rocks repo (bind-mounted).
# DIST_DIR is the html/ dir nginx serves (bind-mounted from the host).
ENV REPO_DIR=/srv/site
ENV DIST_DIR=/srv/dist

EXPOSE 8087
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "index.mjs"]
