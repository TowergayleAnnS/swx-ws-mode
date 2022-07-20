## 简介

> 对基于websocket的场景启动进行一次简单的封装
>

#### 通过NPM安装

``` shell
$ npm install/i swx-ws-mode --save
```
#### 构建sdk
``` shell
$ npm run build
```
#### 发布sdk到NPM包管理
``` shell
$ npm publish
```

##  api

> URL 对象实例化后的第一个参数是链接通道地址
例如:10.1.40.210:8080


> constructor 中有以下属性

| 属性              | 类型     | 默认值 | 说明                                                          |
| ----------------- | -------- | ------ | ------------------------------------------------------------|
| socketUrl         | String   | ''     | websocket链接地址                                            |
| websocket         | WebSocket| null   | WebSocket实例对象                                            |
| resource          | String   | ''     | WebSocket获取资源成功后返回的资源地址                          |
| refreshTimes      | Function | ''     | WebSocket实例保活定时器                                      |
| times             | Function | ''     | WebSocket实例获取排队信息定时器                               |
| location          | Number   | 0      | WebSocket排队队列位置                                        |
| showWaiting       | Boolean  | false  | 是否在排队等待                                               |
| showIframe        | Boolean  | false  | 是否已返回资源地址                                            |
| activeLink        | Boolean  | false  | WebSocket对象是否可用                                         |
| sum               | Number   | 0      | WebSocket排队队列总人数                                       |

> option 中有以下属性

| 属性               | 类型      | 默认值           | 说明                                                          |
| ----------------- | -------- | ------------------| -------------------------------------------------------------|
| Authorization     | String   | ''                | 用户身份信息token     Authorization                           |
| AuthorizationKey  | String   | ''                | 用户鉴权key           AuthorizationKey                        |
| timesSeconds      | Number   | 1000              | WebSocket实例获取排队信息定时器 请求间隔                        |
| refreshSeconds    | Number   | 10000             | WebSocket实例保活定时器 请求间隔                               |
| onOpenAutoSendMsg | Object   | {messageType: "QUEUE_LOCATION"}     |请求排队位置固定参数                          |
| openCallback      | Function |                   | 成功连接时的回调函数                                           |
| messageCallback   | Function |                   | 接收到消息的回调函数                                           |
| errorCallback     | Function |                   | 错误的回调函数                                                 |
| closeCallback     | Function |                   | 关闭时的回调函数                                               |


## Events

| 事件名             | 参数                            | 说明                                                                   |
| ------------------ | :------------------------------ | --------------------------------------------------------------------- |
| send               | message:Any                     | 需要发送的数据信息                                                      |
| tryLock            | -                               | 发起排队  .then(res=>{})返回Promise请求结果                             |
| removeSocket       | -                               | 关闭socke连接并标记关闭状态,成功关闭可触发websocket默认关闭事件onclose    |
| returnSource       | -                               | 主动关闭socke连接并标记关闭状态,成功关闭可触发websocket默认关闭事件onclose |
| getWebsocket       | websocket:Object                | 获取实例化之后的websocket对象                                           |
| getActiveLink      | type:Booble                     | 获取当前socket标记状态,当值为**false**时代表整个socket对象处于不可用状态   |
| websocketOnOpen    | callback:Function(event:Object) | websocket连接建立成功时的回调函数                                       |
| websocketOnMessage | callback:Function(event:Object) | websocket接收到消息时可触发的回调函数                                    |
| websocketOnError   | callback:Function(event:Object) | websocket出现连接错误时触发的回调函数                                    |
| websocketOnClose   | callback:Function(event:Object) | websocket关闭时触发的回调函数                                           |

## 用法示例

``` javascript
import Socket from 'swx-ws-mode'
let socketUrl = "10.1.40.210:8080"

let option = {
   Authorization: 'XXXX',
   AuthorizationKey: 'XXXXX',
   openCallback: res => {
      console.log('建立连接成功', res)
      // ...
   },
   messageCallback: res => {
      // const resData = JSON.parse(res)
      console.log('接收到的消息', res)
      console.log(this.socket)
      this.showIframe = this.socket.showIframe
      this.showWaiting = this.socket.showWaiting
      this.location = this.socket.location
      this.sum = this.socket.sum
      this.resource = this.socket.resource
   }
   //...
}
let ws = new Socket(socketUrl,option) //初始化实例对象
ws.tryLock().then((result) => { //发起排队
   console.log(result)
   if (result.code !== 200 && result.msg !== '') {
      // result.msg 资源占用排队中/未授权，请联系管理员
      // this.$notify({
      // title: '警告',
      // message: `${result.msg}`,
      // type: 'warning'
      // })
   }
}).catch(err => {
   console.log(err)
}) 

//...
//资源断开(会有3分钟间隔归还到资源池)
ws.removeSocket()
//户主动断开链接，立即归还到资源池
ws.returnSource()

