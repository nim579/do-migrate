FROM node:iron-alpine

WORKDIR /migrator

ADD ./package.json .
ADD ./package-lock.json .

RUN npm ci

COPY . .

RUN npm run build

ENTRYPOINT ["npm", "start"]
