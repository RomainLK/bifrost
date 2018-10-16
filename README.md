# Introduction
Bifrost is a HTTP proxy which logs request and response to a server. This is useful for headless environment, or even every day's debugging.

# Features

* Capture request and write them to files
* Handle chunked and gzipped response

# Using

```
npm install
npm run start
```

Files are saved in the `output/<start_time>` folder. 