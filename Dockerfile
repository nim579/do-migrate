FROM node:iron-alpine as build

WORKDIR /migrator

ADD ./package.json .
ADD ./package-lock.json .

RUN npm ci

COPY . .

RUN npm run build && rm -rf src

FROM node:iron-alpine as app

WORKDIR /migrator

ADD ./package.json .
ADD ./package-lock.json .

RUN npm ci --omit dev

COPY ./bin ./bin
COPY --from=build /migrator/lib ./lib

ENTRYPOINT ["npm", "start", "--"]
