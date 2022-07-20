import axios from 'axios';
import CryptoJS from 'crypto-js'
class Socket {
  private socketUrl: string; // 配置的链接地址
  private option: {          // 参数属性
    errorCallback: Function | null;  // 错误的回调
    openCallback: Function | null;   // 连接成功的回调
    closeCallback: Function | null;  // 关闭的回调
    messageCallback: Function | null; // 消息的回调
    timesSeconds: number | 1000,      //time定时器执行间隔
    refreshSeconds: number | 1000,    //refreshTimes定时器执行间隔
    onOpenAutoSendMsg: object;     // 请求排队位置参数
    socketToken: string;           //请求排队位置返回值
    Authorization: string;         //token
    AuthorizationKey: string;      //tokenKey
  };

  private websocket: WebSocket | null;  //WebSocket对象
  private refreshTimes: any;            //refreshTimes定时器 WebSocket实例保活定时器
  private times: any;                   //times定时器 WebSocket实例获取排队信息定时器
  private location: number = 0;         //WebSocket排队队列位置 
  private showWaiting: boolean;         //是否在排队等待 
  private showIframe: boolean;          //是否已返回资源地址

  private sum: number = 0;              //WebSocket排队队列总人数
  private resource: string;             //WebSocket获取资源成功后返回的资源地址
  private activeLink: boolean;          //WebSocket对象是否可用



  constructor(socketUrl: string, option: object) {
    this.socketUrl = socketUrl;
    this.option = {
      onOpenAutoSendMsg: {
        messageType: "QUEUE_LOCATION"
      },
      openCallback: null, // 连接成功的回调
      closeCallback: null, // 关闭的回调
      messageCallback: null, // 消息的回调
      errorCallback: null, // 错误的回调
      timesSeconds: 1000,//time定时器执行间隔
      refreshSeconds: 10000,//refreshTimes定时器执行间隔
      socketToken: '',
      Authorization: '',
      AuthorizationKey: '',
      ...option
    };
    this.websocket = null;
    this.refreshTimes = null;  //轮询
    this.times = null;  //重连定时器
    this.location = 0;  //
    this.showIframe = false;  //
    this.showWaiting = false;  //
    this.sum = 0; //
    this.resource = ""; //
    this.activeLink = true;  //socket对象是否可用
  }
  /**
   * 资源地址解码
   */
  decryptDES(ciphertext: string, key: string) {
    const keyHex = CryptoJS.enc.Utf8.parse(key)
    if (ciphertext) {
      const decrypted = CryptoJS.DES.decrypt(ciphertext, keyHex, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      })
      return decrypted.toString(CryptoJS.enc.Utf8)
    } else {
      return ''
    }
  }
  /**
   * 发起排队请求
   */
  tryLock() {
    return new Promise<void>((resolve, reject) => {
      axios.get(`http://${this.socketUrl}/resource/try-lock`, {
        headers: {
          'Authorization': this.option.Authorization,
          'AuthorizationKey': this.option.AuthorizationKey
        }
      }).then(res => {
        if (res.data.code === 301) {
          console.log(res.data.data.socketToken);
          this.option.socketToken = res.data.data.socketToken;
          this.initWebpack(res.data.data.socketToken);
          resolve(res.data);
        } else {
          this.resetWsInfo()
          resolve(res.data);
          throw new Error(`${res.data.msg}`);
        }

      }).catch(err => {
        reject(err);
      });
    })

  }
  /**
   * 初始化
   */
  initWebpack(socketToken: string) {
    if (!("WebSocket" in window)) {
      throw new Error("当前浏览器不支持");
    }
    if (!this.socketUrl) {
      throw new Error("请配置连接地址");
    }
    this.websocket = null;
    console.log('socketToken', socketToken);

    const url = `ws://${this.socketUrl}/resource/ws?Socket-Token=${socketToken}&Authorization=${this.option.Authorization}`
    this.websocket = new window.WebSocket(url);
    this.websocketOnOpen(null);
    this.websocketOnMessage(null);
    this.websocketOnError(null);
    this.websocketOnClose(null);
  }

  /**
   * 连接成功
   */
  websocketOnOpen(callback: Function | null) {
    if (!(this.websocket instanceof window.WebSocket)) return;
    this.websocket.onopen = (event) => {
      this.send(JSON.stringify(this.option.onOpenAutoSendMsg));
      if (typeof callback === "function") {
        callback(event);
      } else {
        (typeof this.option.openCallback === "function") && this.option.openCallback(event);
      }
    };

  }
  /**
   * 轮询保活
   */
  createSetInterval(socketToken: string) {
    this.stopSetInterval()
    this.refreshTimes = setInterval(() => {
      axios.get(`http://${this.socketUrl}/resource/refresh-token/${socketToken}`, {
        headers: {
          'Authorization': this.option.Authorization, 'AuthorizationKey': this.option.AuthorizationKey
        }
      }).then((res: any) => {
        console.log(res);
      })

    }, this.option.refreshSeconds)
  }
   /**
   * 关闭轮询
   */
  stopSetInterval() {
    if (this.refreshTimes) {
      clearInterval(this.refreshTimes)
      this.refreshTimes = null
    }
  }
   /**
   * 初始化属性
   */ 
  resetWsInfo() {
    this.websocket = null
    this.option.socketToken = ''
    this.showIframe = false
    this.showWaiting = false
    this.location = 0
    this.sum = 0
  }

  /**
   * 发送数据
   * @param message
   */
  send(message: any) {
    if (!(this.websocket instanceof window.WebSocket)) return;
    if (this.websocket.readyState !== this.websocket.OPEN) {
      new Error("没有连接到服务器，无法发送消息");
      return;
    }
    this.websocket.send(message);
  }

  /**
   * 触发接收消息事件
   * @param callback
   */
  websocketOnMessage(callback: Function | null) {
    if (!(this.websocket instanceof window.WebSocket)) return;
    this.websocket.onmessage = (e) => {
      // 收到任何消息，重新开始倒计时心跳检测
      const redata = JSON.parse(e.data)
      console.log(redata)
      this.times = null
      if (redata.data.location) {
        this.showWaiting = true
        this.showIframe = true
        let that = this
        this.location = redata.data.location
        this.sum = redata.data.sum
        this.times = setTimeout(() => {
          const actions = { 'messageType': 'QUEUE_LOCATION' }
          this.send(JSON.stringify(actions))
        }, that.option.timesSeconds)
      } else {
        if (redata.data.resource) {
          const str = redata.socketToken.substring(0, 8);
          this.resource = this.decryptDES(redata.data.resource, str);
          this.showIframe = true;
          clearInterval(this.times);
          axios.get(`http://${this.socketUrl}/resource/confirm/${redata.socketToken}`, {
            headers: {
              'Authorization': this.option.Authorization, 'AuthorizationKey': this.option.AuthorizationKey
            }
          }).then((res: any) => {
            console.log(res);
            this.createSetInterval(redata.socketToken)
          })
        }
        this.showIframe = true
        clearInterval(this.times)
      }
      if (typeof callback === "function") {
        callback(e.data);
      } else {
        (typeof this.option.messageCallback === "function") && this.option.messageCallback({ data: e.data, showIframe: this.showIframe, showWaiting: this.showWaiting });
      }
    };
  }

  /**
   * 连接错误
   * @param callback
   */
  websocketOnError(callback: Function | null) {
    if (!(this.websocket instanceof window.WebSocket)) return;
    this.websocket.onerror = (event) => {
      if (typeof callback === "function") {
        callback(event);
      } else {
        (typeof this.option.errorCallback === "function") && this.option.errorCallback(event);
      }

    };
  }

  /**
   * 连接关闭
   */
  websocketOnClose(callback: Function | null) {
    if (!(this.websocket instanceof window.WebSocket)) return;
    this.websocket.onclose = (event) => {
      this.resetWsInfo()
      this.stopSetInterval()
      if (typeof callback === "function") {
        callback(event);
      } else {
        (typeof this.option.closeCallback === "function") && this.option.closeCallback(event);
      }
    };
  }
  /**
   * 移除socket并关闭
   */
  removeSocket() {
    this.activeLink = false;
    if (!(this.websocket instanceof window.WebSocket)) return;
    this.websocket.close(1000);
  }
  /**
 * 主动连接关闭(断开没有缓冲时间)
 */
  returnSource() {
    this.activeLink = false;
    axios.get(`http://${this.socketUrl}/resource/return/${this.option.socketToken}`, {
      headers: {
        'Authorization': this.option.Authorization, 'AuthorizationKey': this.option.AuthorizationKey
      }
    }).then((res: any) => {
      console.log(res);
    })

    if (!(this.websocket instanceof window.WebSocket)) return;
    this.websocket.close(1000);
  }

  /**
   * 返回websocket实例
   * @returns {null}
   */
  getWebsocket() {
    return this.websocket;
  }

  /**
   * 查看连接状态
   */
  getActiveLink() {
    return this.activeLink;
  }
}
export default Socket
