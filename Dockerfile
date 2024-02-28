FROM node:20-alpine

ENV NODE_ENV production

COPY --chmod=600 root /root
RUN apk add --no-cache bash git yarn coreutils && \
  chmod 0644 /root/.bashrc

WORKDIR /app
COPY package.json index.js ./
COPY src src

RUN yarn install --production

CMD ["index.js"]

ENTRYPOINT ["node"]

EXPOSE 80
