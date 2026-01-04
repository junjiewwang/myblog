# OpenTelemetry Collector Arthas Tunnel Server Extension 实现方案

基于 Arthas Tunnel Server 的详细分析，为在 OpenTelemetry Collector 上实现 tunnel-server extension 提供完整的实现方案。

## 一、架构概览

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    OpenTelemetry Collector + Arthas Tunnel                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────────────┐                           ┌────────────────────────────┐  │
│   │  Web Browser     │◄────── WebSocket ────────►│  OTel Collector            │  │
│   │  (arthas-web-ui) │   ws://collector/ws?      │  ┌──────────────────────┐  │  │
│   └──────────────────┘   method=connectArthas    │  │ Arthas Tunnel Server │  │  │
│                                                   │  │    Extension         │  │  │
│   ┌──────────────────┐                           │  │  ┌────────────────┐  │  │  │
│   │  OTel Java Agent │◄────── WebSocket ────────►│  │  │  AgentRegistry │  │  │  │
│   │  + Arthas Client │   ws://collector/ws?      │  │  └────────────────┘  │  │  │
│   └──────────────────┘   method=agentRegister    │  │  ┌────────────────┐  │  │  │
│          │                                        │  │  │  SessionManager│  │  │  │
│          │ LocalChannel                          │  │  └────────────────┘  │  │  │
│          ▼                                        │  │  ┌────────────────┐  │  │  │
│   ┌──────────────────┐                           │  │  │  RelayHandler  │  │  │  │
│   │  Local Arthas    │                           │  │  └────────────────┘  │  │  │
│   │  Server          │                           │  └──────────────────────┘  │  │
│   └──────────────────┘                           └────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心组件

| 组件 | 职责 |
|------|------|
| **TunnelServerExtension** | OTel Collector Extension 入口，管理生命周期 |
| **WebSocketServer** | 处理 WebSocket 连接，支持 Agent 注册和浏览器连接 |
| **AgentRegistry** | 管理已注册的 Agent 信息 |
| **SessionManager** | 管理 Browser-Agent 会话 |
| **RelayHandler** | 双向数据转发 |
| **HTTPProxyHandler** | HTTP 代理功能（可选） |

---

## 二、WebSocket 协议规范

### 2.1 端点路径

```
ws://{collector_host}:{port}/ws
```

### 2.2 URI 参数定义

| 参数名 | 说明 | 示例 |
|--------|------|------|
| `method` | 请求方法类型 | `agentRegister`, `connectArthas`, `openTunnel`, `httpProxy` |
| `id` | Agent ID | `myapp_ABC123XYZ` |
| `appName` | 应用名称 | `my-service` |
| `arthasVersion` | Arthas 版本 | `4.0.0` |
| `clientConnectionId` | 客户端连接 ID | `CONN_XYZ789` |
| `targetUrl` | HTTP 代理目标 URL | `/api/health` |
| `requestId` | HTTP 代理请求 ID | `REQ_123` |
| `responseData` | HTTP 代理响应数据 (Base64) | `eyJzdGF0dXMiOiJvayJ9` |

### 2.3 方法类型定义

| 方法 | 方向 | 说明 |
|------|------|------|
| `agentRegister` | Agent → Server | Agent 注册到 Tunnel Server |
| `connectArthas` | Browser → Server | 浏览器请求连接某个 Agent |
| `startTunnel` | Server → Agent | 通知 Agent 建立隧道通道 |
| `openTunnel` | Agent → Server | Agent 打开隧道通道 |
| `httpProxy` | 双向 | HTTP 代理请求/响应 |

### 2.4 消息格式

**请求格式（URI 风格）：**
```
ws://server/ws?method=agentRegister&appName=my-service&arthasVersion=4.0.0
```

**响应格式（URI 风格）：**
```
response:/?method=agentRegister&id=my-service_ABC123XYZ
```

---

## 三、核心交互流程

### 3.1 Agent 注册流程

```
┌───────────────┐                              ┌─────────────────┐
│  Arthas Agent │                              │  Tunnel Server  │
└───────┬───────┘                              └────────┬────────┘
        │                                               │
        │  1. WebSocket 握手                            │
        │  GET /ws?method=agentRegister                 │
        │      &appName=my-service                      │
        │      &arthasVersion=4.0.0                     │
        │      [&id=existing-id]  (可选，用于重连)       │
        ├──────────────────────────────────────────────►│
        │                                               │
        │                                               │ 2. 生成/验证 AgentId
        │                                               │    格式: {appName}_{随机20字符}
        │                                               │    或使用 Agent 提供的 id
        │                                               │
        │                                               │ 3. 保存 AgentInfo
        │                                               │    - WebSocket 连接
        │                                               │    - 客户端 IP/Port
        │                                               │    - Arthas 版本
        │                                               │
        │  4. TextWebSocketFrame 响应                   │
        │  response:/?method=agentRegister&id=xxx       │
        │◄──────────────────────────────────────────────┤
        │                                               │
        │  5. 保持连接，定期心跳 (Ping/Pong)             │
        │◄─────────────────────────────────────────────►│
        │                                               │
```

**Go 实现：**

```go
func (s *TunnelServer) handleAgentRegister(conn *websocket.Conn, params url.Values) {
    appName := params.Get("appName")
    arthasVersion := params.Get("arthasVersion")
    
    // 生成或使用已有 ID
    agentId := params.Get("id")
    if agentId == "" {
        if appName != "" {
            agentId = fmt.Sprintf("%s_%s", appName, generateRandomString(20))
        } else {
            agentId = generateRandomString(20)
        }
    }
    
    // 保存 Agent 信息
    agentInfo := &AgentInfo{
        ID:             agentId,
        AppName:        appName,
        ArthasVersion:  arthasVersion,
        Conn:           conn,
        RemoteAddr:     conn.RemoteAddr().String(),
        RegisteredAt:   time.Now(),
    }
    s.agentRegistry.Add(agentId, agentInfo)
    
    // 发送响应
    response := fmt.Sprintf("response:/?method=agentRegister&id=%s", url.QueryEscape(agentId))
    conn.WriteMessage(websocket.TextMessage, []byte(response))
    
    // 注册关闭回调
    conn.SetCloseHandler(func(code int, text string) error {
        s.agentRegistry.Remove(agentId)
        return nil
    })
}
```

### 3.2 浏览器连接 Agent 流程

```
┌──────────┐           ┌─────────────────┐           ┌───────────────┐
│ Browser  │           │  Tunnel Server  │           │ Arthas Agent  │
└────┬─────┘           └────────┬────────┘           └───────┬───────┘
     │                          │                            │
     │ 1. WebSocket 连接        │                            │
     │ /ws?method=connectArthas │                            │
     │     &id=my-service_xxx   │                            │
     ├─────────────────────────►│                            │
     │                          │                            │
     │                          │ 2. 查找 Agent              │
     │                          │    if not found → 返回错误  │
     │                          │                            │
     │                          │ 3. 生成 clientConnectionId │
     │                          │    创建 Promise/Channel    │
     │                          │                            │
     │                          │ 4. 发送 startTunnel 指令   │
     │                          │ response:/?method=startTunnel
     │                          │   &id=my-service_xxx       │
     │                          │   &clientConnectionId=yyy  │
     │                          ├───────────────────────────►│
     │                          │                            │
     │                          │                            │ 5. Agent 收到指令
     │                          │                            │    启动 ForwardClient
     │                          │                            │
     │                          │ 6. 新 WebSocket 连接       │
     │                          │ /ws?method=openTunnel      │
     │                          │   &clientConnectionId=yyy  │
     │                          │◄───────────────────────────┤
     │                          │                            │
     │                          │ 7. Promise 完成            │
     │                          │    建立双向 Relay          │
     │                          │                            │
     │◄─────────────────────────┼───────────────────────────►│
     │        8. 双向数据转发 (WebSocket Binary/Text)        │
     │                          │                            │
```

**Go 实现：**

```go
func (s *TunnelServer) handleConnectArthas(browserConn *websocket.Conn, params url.Values) error {
    agentId := params.Get("id")
    
    // 1. 查找 Agent
    agentInfo, ok := s.agentRegistry.Get(agentId)
    if !ok {
        browserConn.WriteMessage(websocket.CloseMessage, 
            websocket.FormatCloseMessage(4000, "Agent not found: "+agentId))
        return fmt.Errorf("agent not found: %s", agentId)
    }
    
    // 2. 生成 clientConnectionId
    clientConnId := generateRandomString(20)
    
    // 3. 创建等待通道
    tunnelChan := make(chan *websocket.Conn, 1)
    s.pendingConnections.Store(clientConnId, tunnelChan)
    defer s.pendingConnections.Delete(clientConnId)
    
    // 4. 通知 Agent 建立隧道
    startTunnelMsg := fmt.Sprintf("response:/?method=startTunnel&id=%s&clientConnectionId=%s",
        url.QueryEscape(agentId), url.QueryEscape(clientConnId))
    agentInfo.Conn.WriteMessage(websocket.TextMessage, []byte(startTunnelMsg))
    
    // 5. 等待 Agent 打开隧道 (超时 20 秒)
    select {
    case tunnelConn := <-tunnelChan:
        // 6. 建立双向转发
        go s.relay(browserConn, tunnelConn)
        go s.relay(tunnelConn, browserConn)
        return nil
        
    case <-time.After(20 * time.Second):
        return fmt.Errorf("timeout waiting for agent tunnel")
    }
}

func (s *TunnelServer) handleOpenTunnel(tunnelConn *websocket.Conn, params url.Values) {
    clientConnId := params.Get("clientConnectionId")
    
    // 查找等待的连接
    if ch, ok := s.pendingConnections.Load(clientConnId); ok {
        ch.(chan *websocket.Conn) <- tunnelConn
    }
}
```

### 3.3 双向数据转发

```go
func (s *TunnelServer) relay(src, dst *websocket.Conn) {
    defer src.Close()
    defer dst.Close()
    
    for {
        messageType, data, err := src.ReadMessage()
        if err != nil {
            return
        }
        
        if err := dst.WriteMessage(messageType, data); err != nil {
            return
        }
    }
}
```

---

## 四、数据结构定义

### 4.1 AgentInfo

```go
type AgentInfo struct {
    ID             string          `json:"id"`
    AppName        string          `json:"appName,omitempty"`
    ArthasVersion  string          `json:"arthasVersion,omitempty"`
    Host           string          `json:"host"`
    Port           int             `json:"port"`
    Conn           *websocket.Conn `json:"-"`
    RegisteredAt   time.Time       `json:"registeredAt"`
    LastHeartbeat  time.Time       `json:"lastHeartbeat"`
}
```

### 4.2 ClientConnectionInfo

```go
type ClientConnectionInfo struct {
    ID             string          `json:"id"`
    AgentID        string          `json:"agentId"`
    BrowserConn    *websocket.Conn `json:"-"`
    TunnelConn     *websocket.Conn `json:"-"`
    Host           string          `json:"host"`
    Port           int             `json:"port"`
    CreatedAt      time.Time       `json:"createdAt"`
}
```

### 4.3 TunnelServerConfig

```go
type Config struct {
    // WebSocket 监听地址
    Endpoint string `mapstructure:"endpoint"`
    
    // WebSocket 路径
    Path string `mapstructure:"path"`
    
    // 心跳间隔 (秒)
    HeartbeatInterval int `mapstructure:"heartbeat_interval"`
    
    // 连接超时 (秒)
    ConnectionTimeout int `mapstructure:"connection_timeout"`
    
    // 最大连接数
    MaxConnections int `mapstructure:"max_connections"`
    
    // 是否启用 HTTP Proxy
    EnableHTTPProxy bool `mapstructure:"enable_http_proxy"`
    
    // Agent 清理间隔 (秒)
    CleanupInterval int `mapstructure:"cleanup_interval"`
}
```

---

## 五、心跳与保活机制

### 5.1 心跳配置

```go
const (
    // 空闲检测间隔
    IdleTimeout = 10 * time.Second
    
    // Ping 间隔
    PingInterval = 30 * time.Second
    
    // Pong 等待超时
    PongTimeout = 60 * time.Second
)
```

### 5.2 心跳实现

```go
func (s *TunnelServer) startHeartbeat(conn *websocket.Conn, agentId string) {
    ticker := time.NewTicker(PingInterval)
    defer ticker.Stop()
    
    conn.SetPongHandler(func(string) error {
        // 更新最后心跳时间
        if info, ok := s.agentRegistry.Get(agentId); ok {
            info.LastHeartbeat = time.Now()
        }
        return nil
    })
    
    for {
        select {
        case <-ticker.C:
            if err := conn.WriteControl(websocket.PingMessage, nil, 
                time.Now().Add(10*time.Second)); err != nil {
                return
            }
        }
    }
}
```

---

## 六、HTTP Proxy 功能（可选）

### 6.1 流程

```
HTTP Client                 Tunnel Server                 Agent
    │                            │                          │
    │ GET /proxy/{agentId}/xxx   │                          │
    ├───────────────────────────►│                          │
    │                            │                          │
    │                            │ TextFrame: httpProxy     │
    │                            │   targetUrl=/xxx         │
    │                            │   requestId=REQ_123      │
    │                            ├─────────────────────────►│
    │                            │                          │
    │                            │                          │ 请求本地 Arthas
    │                            │                          │
    │                            │ TextFrame: httpProxy     │
    │                            │   requestId=REQ_123      │
    │                            │   responseData=base64()  │
    │                            │◄─────────────────────────┤
    │                            │                          │
    │ HTTP Response              │                          │
    │◄───────────────────────────┤                          │
```

### 6.2 响应数据格式

```go
type SimpleHTTPResponse struct {
    Status  int               `json:"status"`
    Headers map[string]string `json:"headers"`
    Body    []byte            `json:"body"`
}

// 序列化为 Base64
func (r *SimpleHTTPResponse) ToBase64() string {
    data, _ := json.Marshal(r)
    return base64.StdEncoding.EncodeToString(data)
}
```

---

## 七、OTel Collector Extension 实现

### 7.1 Extension 接口

```go
package arthastunnel

import (
    "context"
    "go.opentelemetry.io/collector/component"
    "go.opentelemetry.io/collector/extension"
)

type arthasTunnelExtension struct {
    config *Config
    server *TunnelServer
    logger *zap.Logger
}

func NewFactory() extension.Factory {
    return extension.NewFactory(
        "arthas_tunnel",
        createDefaultConfig,
        createExtension,
        component.StabilityLevelAlpha,
    )
}

func createDefaultConfig() component.Config {
    return &Config{
        Endpoint:          "0.0.0.0:7777",
        Path:              "/ws",
        HeartbeatInterval: 30,
        ConnectionTimeout: 20,
        MaxConnections:    1000,
        EnableHTTPProxy:   true,
        CleanupInterval:   60,
    }
}

func createExtension(
    ctx context.Context,
    set extension.CreateSettings,
    cfg component.Config,
) (extension.Extension, error) {
    config := cfg.(*Config)
    return &arthasTunnelExtension{
        config: config,
        logger: set.Logger,
    }, nil
}

func (e *arthasTunnelExtension) Start(ctx context.Context, host component.Host) error {
    e.server = NewTunnelServer(e.config, e.logger)
    return e.server.Start()
}

func (e *arthasTunnelExtension) Shutdown(ctx context.Context) error {
    if e.server != nil {
        return e.server.Stop()
    }
    return nil
}
```

### 7.2 配置文件示例

```yaml
extensions:
  arthas_tunnel:
    endpoint: "0.0.0.0:7777"
    path: "/ws"
    heartbeat_interval: 30
    connection_timeout: 20
    max_connections: 1000
    enable_http_proxy: true
    cleanup_interval: 60

service:
  extensions: [arthas_tunnel]
```

---

## 八、完整代码结构

```
otelcol-contrib/extension/arthastunnelextension/
├── config.go                 # 配置定义
├── factory.go                # Extension 工厂
├── extension.go              # Extension 实现
├── server.go                 # WebSocket 服务器
├── handler.go                # WebSocket 消息处理
├── registry.go               # Agent 注册表
├── session.go                # 会话管理
├── relay.go                  # 数据转发
├── proxy.go                  # HTTP Proxy (可选)
├── constants.go              # 常量定义
├── types.go                  # 数据类型
└── README.md                 # 文档
```

---

## 九、关键实现细节

### 9.1 WebSocket 升级处理

```go
var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        return true // 生产环境应做安全校验
    },
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
}

func (s *TunnelServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    // 解析参数
    params := r.URL.Query()
    method := params.Get("method")
    
    // 升级为 WebSocket
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        return
    }
    
    // 根据 method 分发处理
    switch method {
    case "agentRegister":
        s.handleAgentRegister(conn, params)
    case "connectArthas":
        s.handleConnectArthas(conn, params)
    case "openTunnel":
        s.handleOpenTunnel(conn, params)
    default:
        conn.Close()
    }
}
```

### 9.2 Agent 注册表（并发安全）

```go
type AgentRegistry struct {
    agents sync.Map // map[string]*AgentInfo
}

func (r *AgentRegistry) Add(id string, info *AgentInfo) {
    r.agents.Store(id, info)
}

func (r *AgentRegistry) Get(id string) (*AgentInfo, bool) {
    v, ok := r.agents.Load(id)
    if !ok {
        return nil, false
    }
    return v.(*AgentInfo), true
}

func (r *AgentRegistry) Remove(id string) {
    r.agents.Delete(id)
}

func (r *AgentRegistry) List() []*AgentInfo {
    var result []*AgentInfo
    r.agents.Range(func(key, value interface{}) bool {
        result = append(result, value.(*AgentInfo))
        return true
    })
    return result
}
```

### 9.3 定期清理不活跃 Agent

```go
func (s *TunnelServer) startCleanupTask() {
    ticker := time.NewTicker(time.Duration(s.config.CleanupInterval) * time.Second)
    go func() {
        for range ticker.C {
            s.agentRegistry.agents.Range(func(key, value interface{}) bool {
                info := value.(*AgentInfo)
                // 检查连接是否仍然活跃
                if err := info.Conn.WriteControl(websocket.PingMessage, nil, 
                    time.Now().Add(5*time.Second)); err != nil {
                    s.agentRegistry.Remove(key.(string))
                    s.logger.Info("Removed inactive agent", zap.String("id", key.(string)))
                }
                return true
            })
        }
    }()
}
```

---

## 十、API 端点汇总

| 端点 | 方法 | 说明 |
|------|------|------|
| `GET /ws?method=agentRegister&...` | WebSocket | Agent 注册 |
| `GET /ws?method=connectArthas&id=xxx` | WebSocket | 浏览器连接 Agent |
| `GET /ws?method=openTunnel&clientConnectionId=xxx` | WebSocket | Agent 打开隧道 |
| `GET /api/agents` | HTTP | 获取所有已注册 Agent 列表 |
| `GET /api/agents/{id}` | HTTP | 获取指定 Agent 信息 |
| `GET /proxy/{agentId}/**` | HTTP | HTTP 代理（可选） |

---

## 十一、安全考虑

1. **认证**：生产环境应增加 Token/API Key 认证
2. **TLS**：使用 `wss://` 加密传输
3. **限流**：限制单 IP 连接数和请求频率
4. **Origin 校验**：WebSocket 升级时校验 Origin 头
5. **Agent ID 校验**：防止 Agent ID 冲突和伪造

---

## 十二、与原 Arthas Tunnel Server 的兼容性

本方案完全兼容原 Arthas Tunnel 协议，现有的：
- Arthas Agent (`arthas-tunnel-client`) 可直接连接
- Arthas Web UI 可直接使用
- `as.sh --tunnel-server` 参数可直接指向 OTel Collector
