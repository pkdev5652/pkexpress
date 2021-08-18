var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 5050;

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

var matchlist = {};
var usersOnline = [];
var rooms={};


io.of(/^\/.+$/).on('connect', function (socket) {
	var nsp =socket.nsp;
	nsp.maxuser =2;

	
	var cancelmatch = function(){
		if(matchlist[nsp.name]){
			var index = matchlist[nsp.name].indexOf(socket);
			if(index !== -1){
				matchlist[nsp.name].splice(index,1);
				console.log(socket.username + "退出排队",);
			}
		}
		
	};

	var leaveroom = function(){
		if(socket.roomname){
				var index = rooms[socket.roomname].userlist.indexOf(socket.username);
				rooms[socket.roomname].userlist.splice(index, 1);
				socket.leave(socket.roomname);
				var data ={};
				data.username = socket.username;
				data.userlist = rooms[socket.roomname].userlist;
				nsp.in(socket.roomname).emit('otherleftroom', data); 
				socket.emit("leftroom",{});
				
				console.log(socket.username +"离开了房间"+socket.roomname+ ",剩余用户："+ data.userlist +",人数："+ data.userlist.length);
						
				if(data.userlist.length<=0){
					delete rooms[socket.roomname];
					console.log(socket.roomname +"已销毁");
				}
				socket.roomname="";	
		}
	};


	socket.on("login",function (username){
		if(!socket.username){
			var index = usersOnline.indexOf(username);
			if(index == -1){
				socket.username=username;
				usersOnline.push(username);
				var data ={};
				socket.emit("logedin",data);
				console.log(socket.username +"登录服务器");
			}else {
				var data ={};
				data.code =1;
				data.desc = "duplicate username";
				socket.emit("goterror",data);
			}
		}
	});
	
	socket.on("joinroom",function (roomname){
		if(socket.username){
			if(!socket.roomname){
				roomname=nsp.name + "_" + roomname;
				if (!rooms[roomname]) {
				  rooms[roomname] ={};
				  rooms[roomname].userlist = [];
				}
				if(rooms[roomname].userlist.length >=nsp.maxuser){
					var data ={};
					data.code =4;
					data.desc = "room full";
					socket.emit("goterror",data);
				}else{
						rooms[roomname].userlist.push(socket.username);
						socket.roomname=roomname;
						socket.join(roomname); 
						var data ={};
						data.username = socket.username;
						data.usernum = rooms[roomname].userlist.length;
						data.userlist = rooms[roomname].userlist;

						nsp.in(roomname).emit('joinedroom', data);  
						
						console.log(socket.username +"加入了房间"+ socket.roomname+",房间用户："+ data.userlist+",人数："+ data.userlist.length);

					
				}
			}else {
				var data ={};
				data.code =5;
				data.desc = "already in a room";
				socket.emit("goterror",data);
			}
				

		}
	});
	
	
	socket.on("startmatch",function(){
		if(socket.username){
			if (!matchlist[nsp.name]) {
				  matchlist[nsp.name] =[];
				}
			var index = matchlist[nsp.name].indexOf(socket);
			if(index == -1){
				matchlist[nsp.name].push(socket);
				if(matchlist[nsp.name].length>=nsp.maxuser){

					var roomname = "" + Date.now();
					var userlist = [];
					if (!rooms[roomname]) {
					  rooms[roomname] ={};
					  rooms[roomname].userlist = [];
					}
					for(var i=0; i < nsp.maxuser; i++){
						matchlist[nsp.name][i].join(roomname);
						matchlist[nsp.name][i].roomname=roomname;
						userlist.push(matchlist[nsp.name][i].username);
					}
					matchlist[nsp.name].splice(0,nsp.maxuser);		
					rooms[roomname].userlist=userlist;
					nsp.in(roomname).emit('matched', {"userlist":userlist}); 
					console.log("新房间：" +roomname);
				}
				console.log("当前排队人数"+matchlist[nsp.name].length);
			}
		}else {
				var data ={};
				data.code =2;
				data.desc = "not logedin";
				socket.emit("goterror",data);
			}
		
	});

	socket.on('sendmessage', function (title, eventContent) {
		if(socket.roomname){
			var data ={};
			data.from = socket.username;
			data.name = title;
			data.content = eventContent;
			nsp.in(socket.roomname).emit('gotmessage', data); 
			console.log(socket.username +"在房间"+socket.roomname +"中发送事件："+ title + "，事件内容：" +eventContent);
		}else {
				var data ={};
				data.code =3;
				data.desc = "not in room";
				socket.emit("goterror",data);
			}
	});
  
	socket.on("cancelmatch",cancelmatch);
	socket.on('leaveroom', leaveroom);
  
	socket.on('disconnect', function () {
		cancelmatch();
		leaveroom();
		if(socket.username){
			var index = usersOnline.indexOf(socket.username);
			usersOnline.splice(index,1);
			socket.username=null;
		}
	});
	
	socket.on('setmaxuser', function (maxuser) {
		nsp.maxuser = maxuser;   
	});
});



http.listen(port, function(){
	console.log('listening on *:' + port);
});