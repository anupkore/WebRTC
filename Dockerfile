# FROM node:12-alpine

FROM registry.access.redhat.com/ubi8/nodejs-16:1

 

WORKDIR /app

 

USER root

 

COPY --chown=1001:0 package*.json ./

 

USER 1001

 

ENV key=value

 

RUN npm install

 

COPY . .

 

ENV NODE_OPTIONS="--max-old-space-size=12288"

 

# Change user to root before changing ownership of .eslintcache

USER root

 

RUN mkdir -p /app/node_modules/.cache/.eslintcache

 

RUN chown 1001:0 /app/node_modules/.cache/.eslintcache

 

RUN chmod 777 /app/node_modules/.cache/.eslintcache

 

# Change user back to node

USER 1001

EXPOSE 3000

 

CMD [ "npm", "start" ]
