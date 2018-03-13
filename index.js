const express = require('express');
const app = express();

app.use(express.static("D:/Chatbots/DemoStore (1)/herokuapp/web"))
app.listen(process.env.PORT || 3007);