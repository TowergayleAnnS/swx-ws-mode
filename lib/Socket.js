import axios from 'axios';
import CryptoJS from 'crypto-js';

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    enumerableOnly && (symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    })), keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = null != arguments[i] ? arguments[i] : {};
    i % 2 ? ownKeys(Object(source), !0).forEach(function (key) {
      _defineProperty(target, key, source[key]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    });
  }

  return target;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

class Socket {
  // 配置的链接地址
  //WebSocket对象
  //refreshTimes定时器 WebSocket实例保活定时器
  //times定时器 WebSocket实例获取排队信息定时器
  //WebSocket排队队列位置 
  //是否在排队等待 
  //是否已返回资源地址
  //WebSocket排队队列总人数
  //WebSocket获取资源成功后返回的资源地址
  //WebSocket对象是否可用
  constructor(socketUrl, option) {
    _defineProperty(this, "socketUrl", void 0);

    _defineProperty(this, "option", void 0);

    _defineProperty(this, "websocket", void 0);

    _defineProperty(this, "refreshTimes", void 0);

    _defineProperty(this, "times", void 0);

    _defineProperty(this, "location", 0);

    _defineProperty(this, "showWaiting", void 0);

    _defineProperty(this, "showIframe", void 0);

    _defineProperty(this, "sum", 0);

    _defineProperty(this, "resource", void 0);

    _defineProperty(this, "activeLink", void 0);

    this.socketUrl = socketUrl;
    this.option = _objectSpread2({
      onOpenAutoSendMsg: {
        messageType: "QUEUE_LOCATION"
      },
      openCallback: null,
      closeCallback: null,
      messageCallback: null,
      errorCallback: null,
      timesSeconds: 1000,
      refreshSeconds: 10000,
      socketToken: '',
      Authorization: '',
      AuthorizationKey: ''
    }, option);
    this.websocket = null;
    this.refreshTimes = null; //轮询

    this.times = null; //重连定时器

    this.location = 0; //

    this.showIframe = false; //

    this.showWaiting = false; //

    this.sum = 0; //

    this.resource = ""; //

    this.activeLink = true; //socket对象是否可用
  }
  /**
   * 资源地址解码
   */


  decryptDES(ciphertext, key) {
    const keyHex = CryptoJS.enc.Utf8.parse(key);

    if (ciphertext) {
      const decrypted = CryptoJS.DES.decrypt(ciphertext, keyHex, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    } else {
      return '';
    }
  }
  /**
   * 发起排队请求
   */


  tryLock() {
    return new Promise((resolve, reject) => {
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
          this.resetWsInfo();
          resolve(res.data);
          throw new Error(`${res.data.msg}`);
        }
      }).catch(err => {
        reject(err);
      });
    });
  }
  /**
   * 初始化
   */


  initWebpack(socketToken) {
    if (!("WebSocket" in window)) {
      throw new Error("当前浏览器不支持");
    }

    if (!this.socketUrl) {
      throw new Error("请配置连接地址");
    }

    this.websocket = null;
    console.log('socketToken', socketToken);
    const url = `ws://${this.socketUrl}/resource/ws?Socket-Token=${socketToken}&Authorization=${this.option.Authorization}`;
    this.websocket = new window.WebSocket(url);
    this.websocketOnOpen(null);
    this.websocketOnMessage(null);
    this.websocketOnError(null);
    this.websocketOnClose(null);
  }
  /**
   * 连接成功
   */


  websocketOnOpen(callback) {
    if (!(this.websocket instanceof window.WebSocket)) return;

    this.websocket.onopen = event => {
      this.send(JSON.stringify(this.option.onOpenAutoSendMsg));

      if (typeof callback === "function") {
        callback(event);
      } else {
        typeof this.option.openCallback === "function" && this.option.openCallback(event);
      }
    };
  }
  /**
   * 轮询保活
   */


  createSetInterval(socketToken) {
    this.stopSetInterval();
    this.refreshTimes = setInterval(() => {
      axios.get(`http://${this.socketUrl}/resource/refresh-token/${socketToken}`, {
        headers: {
          'Authorization': this.option.Authorization,
          'AuthorizationKey': this.option.AuthorizationKey
        }
      }).then(res => {
        console.log(res);
      });
    }, this.option.refreshSeconds);
  }
  /**
  * 关闭轮询
  */


  stopSetInterval() {
    if (this.refreshTimes) {
      clearInterval(this.refreshTimes);
      this.refreshTimes = null;
    }
  }
  /**
  * 初始化属性
  */


  resetWsInfo() {
    this.websocket = null;
    this.option.socketToken = '';
    this.showIframe = false;
    this.showWaiting = false;
    this.location = 0;
    this.sum = 0;
  }
  /**
   * 发送数据
   * @param message
   */


  send(message) {
    if (!(this.websocket instanceof window.WebSocket)) return;

    if (this.websocket.readyState !== this.websocket.OPEN) {
      return;
    }

    this.websocket.send(message);
  }
  /**
   * 触发接收消息事件
   * @param callback
   */


  websocketOnMessage(callback) {
    if (!(this.websocket instanceof window.WebSocket)) return;

    this.websocket.onmessage = e => {
      // 收到任何消息，重新开始倒计时心跳检测
      const redata = JSON.parse(e.data);
      console.log(redata);
      this.times = null;

      if (redata.data.location) {
        this.showWaiting = true;
        this.showIframe = true;
        let that = this;
        this.location = redata.data.location;
        this.sum = redata.data.sum;
        this.times = setTimeout(() => {
          const actions = {
            'messageType': 'QUEUE_LOCATION'
          };
          this.send(JSON.stringify(actions));
        }, that.option.timesSeconds);
      } else {
        if (redata.data.resource) {
          const str = redata.socketToken.substring(0, 8);
          this.resource = this.decryptDES(redata.data.resource, str);
          this.showIframe = true;
          clearInterval(this.times);
          axios.get(`http://${this.socketUrl}/resource/confirm/${redata.socketToken}`, {
            headers: {
              'Authorization': this.option.Authorization,
              'AuthorizationKey': this.option.AuthorizationKey
            }
          }).then(res => {
            console.log(res);
            this.createSetInterval(redata.socketToken);
          });
        }

        this.showIframe = true;
        clearInterval(this.times);
      }

      if (typeof callback === "function") {
        callback(e.data);
      } else {
        typeof this.option.messageCallback === "function" && this.option.messageCallback({
          data: e.data,
          showIframe: this.showIframe,
          showWaiting: this.showWaiting
        });
      }
    };
  }
  /**
   * 连接错误
   * @param callback
   */


  websocketOnError(callback) {
    if (!(this.websocket instanceof window.WebSocket)) return;

    this.websocket.onerror = event => {
      if (typeof callback === "function") {
        callback(event);
      } else {
        typeof this.option.errorCallback === "function" && this.option.errorCallback(event);
      }
    };
  }
  /**
   * 连接关闭
   */


  websocketOnClose(callback) {
    if (!(this.websocket instanceof window.WebSocket)) return;

    this.websocket.onclose = event => {
      this.resetWsInfo();
      this.stopSetInterval();

      if (typeof callback === "function") {
        callback(event);
      } else {
        typeof this.option.closeCallback === "function" && this.option.closeCallback(event);
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
        'Authorization': this.option.Authorization,
        'AuthorizationKey': this.option.AuthorizationKey
      }
    }).then(res => {
      console.log(res);
    });
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

export { Socket as default };
