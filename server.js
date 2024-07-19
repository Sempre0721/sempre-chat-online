const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // 引入path模块

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 配置静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 处理根路径，发送index.html文件
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// 创建并打开数据库
const db = new sqlite3.Database('./chat.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the chat database.');
});

// 创建聊天记录表
db.run('CREATE TABLE IF NOT EXISTS chatlog (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Chatlog table created successfully.');
});

io.on('connection', (socket) => {
    console.log('新用户连接');

    // 获取历史聊天记录并发送给新用户
    db.all('SELECT * FROM chatlog ORDER BY timestamp ASC', [], (err, rows) => {
        if (err) {
            throw err;
        }
        rows.forEach(row => {
            socket.emit('chat message', { username: row.username, text: row.message });
        });
    });

    socket.on('set username', (username) => {
        socket.username = username;
        // 向所有客户端广播新用户加入的信息
        io.emit('chat message', { username: '系统', text: `${username} 加入了聊天室！` });
        
        // 发送一条欢迎消息给新用户
        socket.emit('chat message', { username: '系统', text: `欢迎，${username}!` });
        
    });

    socket.on('chat message', (data) => {
        console.log(`message: ${data.text}`);

        // 插入新消息到数据库
        db.run('INSERT INTO chatlog (username, message) VALUES (?, ?)', [socket.username, data.text], function(err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`Message inserted with rowid ${this.lastID}`);
        });

        io.emit('chat message', { username: socket.username, text: data.text });
    });

    socket.on('disconnect', () => {
        console.log(`用户${socket.username}断开连接`);
    });
});

server.listen(3670, () => {
    console.log("Application started and Listening on port 3670");
    console.log("请打开浏览器，访问 http://localhost:3670");
});