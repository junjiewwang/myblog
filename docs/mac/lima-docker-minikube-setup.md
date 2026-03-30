# macOS Lima Docker + Minikube 开发环境搭建指南

> 本文档以 Lima 官方 docker-rootful 模板为基础，指导在 macOS 上从零搭建完整的 Docker + Minikube 开发环境，并通过 socket_vmnet + docker-connector 实现稳定的外网访问和 Mac↔容器网络互通。

## 1. 目标架构

### 1.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│  macOS 宿主机                                                │
│                                                             │
│  docker CLI ──(unix socket)──┐                              │
│                               │                              │
│  docker-connector ────UDP:2521──┐                            │
│  (utun0: 192.168.252.2)        │                             │
│  路由表（自动管理）:              │                             │
│    172.17-25.0.0/16 → utun0    │                             │
│    192.168.49.0/24  → utun0    │                             │
│    10.96.0.0/16     → utun0    │                             │
│                                │                             │
│  ┌─────────────────────────────┼─────────────────────────┐   │
│  │  Lima VM (Ubuntu 24.04)     │                         │   │
│  │                              │                         │   │
│  │  lima0: 192.168.105.x ──── socket_vmnet (外网, 稳定)   │   │
│  │  eth0:  192.168.5.x  ──── vzNAT (备用, docker-connector│   │
│  │                              UDP 隧道承载层)            │   │
│  │  tun0:  192.168.252.1 ──── mac-connector 容器创建       │   │
│  │                                                        │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │  Docker Engine (iptables: false)                 │  │   │
│  │  │  docker0:        172.17.0.1/16 (默认 bridge)     │  │   │
│  │  │  br-xxx:         172.20.0.1/16 (自定义网络)       │  │   │
│  │  │  br-minikube:    192.168.49.1/24 (minikube)      │  │   │
│  │  │                                                  │  │   │
│  │  │  mac-connector 容器 (--net host, CAP_NET_ADMIN)  │  │   │
│  │  │  minikube 容器 (K8s 集群)                         │  │   │
│  │  │  业务容器...                                      │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                              │
│  socket_vmnet daemon ←→ vmnet.framework shared NAT           │
│  (192.168.105.1 网关, macOS 原生 NAT)                         │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 各组件职责

| 组件 | 职责 | 解决什么问题 |
|------|------|-------------|
| Lima | 在 macOS 上运行 Linux VM | macOS 无原生 Docker 支持 |
| socket_vmnet (lima0) | VM 外网访问 | vzNAT 的 TCP 连接偶发超时 |
| docker-connector (Mac 端) | 自动管理 Mac 路由表 | Mac 直接访问容器/K8s IP |
| mac-connector (VM 容器端) | 创建 tun0 隧道端点 | 与 Mac 端 docker-connector 配合 |
| Minikube | VM 内的 K8s 集群 | 本地 K8s 开发测试 |

### 1.3 为什么需要 socket_vmnet + docker-connector 混用？

| 问题 | 解决方案 |
|------|----------|
| VM 外网 TCP 不稳定（vzNAT 缺陷） | socket_vmnet 提供稳定的 macOS 原生 NAT |
| Mac 无法直接访问容器 IP | docker-connector 建立 tun 隧道 + 自动路由 |
| 路由管理繁琐 | docker-connector 配置文件声明式管理，热加载 |

---

## 2. 前置条件

| 项目 | 要求 |
|------|------|
| macOS | 13+ (Ventura 及以上), Apple Silicon 或 Intel |
| Xcode Command Line Tools | `xcode-select --install` |
| Homebrew | https://brew.sh |
| 磁盘空间 | 建议预留 50GB+ |

---

## 3. 第一步：安装 Lima

```bash
# 安装 Lima
brew install lima

# 验证
limactl --version
# 期望输出: limactl version 1.1.1 或更高
```

---

## 4. 第二步：安装并配置 socket_vmnet

### 4.1 为什么不用 Homebrew 安装？

Lima v1.0.0+ 要求 socket_vmnet 二进制文件必须由 **root 拥有**，安装在只有 root 可修改的路径中。Homebrew 安装的文件属于当前用户，不满足安全要求，`limactl sudoers` 命令会拒绝。

### 4.2 从源码安装（官方推荐方式）

```bash
# 1. 克隆仓库
git clone https://github.com/lima-vm/socket_vmnet
cd socket_vmnet

# 2. 检出版本（查看最新版本: https://github.com/lima-vm/socket_vmnet/releases）
git checkout v1.2.1

# 3. 编译
make

# 4. 安装到 /opt/socket_vmnet（root 拥有）
sudo make PREFIX=/opt/socket_vmnet install.bin

# 5. 验证安装
ls -la /opt/socket_vmnet/bin/socket_vmnet
# 应显示: -rwxr-xr-x  1 root  wheel  ... /opt/socket_vmnet/bin/socket_vmnet

# 6. 清理源码
cd ..
rm -rf socket_vmnet
```

### 4.3 配置 Lima sudoers

```bash
# 1. 生成 sudoers 配置
limactl sudoers > etc_sudoers.d_lima

# 2. 检查内容（确保路径和权限正确）
cat etc_sudoers.d_lima

# 3. 安装到系统
sudo install -o root etc_sudoers.d_lima /etc/sudoers.d/lima

# 4. 清理
rm etc_sudoers.d_lima
```

### 4.4 验证 networks.yaml

检查 `~/.lima/_config/networks.yaml`（Lima 安装时自动生成）：

```yaml
paths:
  socketVMNet: "/opt/socket_vmnet/bin/socket_vmnet"  # 必须指向 root 拥有的路径
  varRun: /private/var/run/lima
  sudoers: /private/etc/sudoers.d/lima

networks:
  shared:
    mode: shared
    gateway: 192.168.105.1
    dhcpEnd: 192.168.105.254
    netmask: 255.255.255.0
```

> 如果 `socketVMNet` 路径不是 `/opt/socket_vmnet/bin/socket_vmnet`，请手动修正。

---

## 5. 第三步：创建 Docker Rootful 虚拟机

### 5.1 准备 lima.yaml

基于 Lima 官方 docker-rootful 模板，创建配置文件：

```bash
mkdir -p ~/lima-templates
cat > ~/lima-templates/docker.yaml << 'YAML_EOF'
# 基于 Lima 官方 docker-rootful 模板
# 参考: https://github.com/lima-vm/lima/blob/master/templates/docker-rootful.yaml

minimumLimaVersion: 1.1.0

# containerd 由 Docker 管理，Lima 不管理
containerd:
  system: false
  user: false

provision:
# 配置 host.docker.internal 域名
- mode: system
  script: |
    #!/bin/sh
    sed -i 's/host.lima.internal.*/host.lima.internal host.docker.internal/' /etc/hosts

# 安装 Docker（含 GitHub 可达性检测）
# 注意：rootful 模式，Docker 以 root 运行，使用 sudo docker 操作
- mode: system
  script: |
    #!/bin/bash
    set -eu -o pipefail
    command -v docker >/dev/null 2>&1 && exit 0
    export DEBIAN_FRONTEND=noninteractive

    # ===== GitHub 可达性检测 =====
    # get.docker.com 脚本内部需要从 GitHub Releases 下载 docker-compose-plugin、
    # docker-buildx-plugin 等组件，GitHub 不可达时安装会失败
    echo "🔍 检测 GitHub 可达性..."
    if ! curl -sS --connect-timeout 10 -o /dev/null https://github.com 2>/dev/null; then
      echo ""
      echo "=========================================="
      echo "⚠️  Docker 自动安装已跳过：无法访问 GitHub"
      echo "=========================================="
      echo ""
      echo "get.docker.com 脚本需要从 GitHub Releases 下载插件，当前网络不可达。"
      echo "VM 仍会正常启动，请通过 APT 源手动安装（不依赖 GitHub）："
      echo ""
      echo "  limactl shell docker -- sudo bash -c '"
      echo "    apt-get update && apt-get install -y ca-certificates curl gnupg"
      echo "    && install -m 0755 -d /etc/apt/keyrings"
      echo "    && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg"
      echo "    && chmod a+r /etc/apt/keyrings/docker.gpg"
      echo "    && echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo \$VERSION_CODENAME) stable\" > /etc/apt/sources.list.d/docker.list"
      echo "    && apt-get update"
      echo "    && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
      echo "    && mkdir -p /etc/docker"
      echo "    && printf \"{\\n  \\\"iptables\\\": false,\\n  \\\"log-driver\\\": \\\"json-file\\\",\\n  \\\"log-opts\\\": {\\\"max-file\\\": \\\"3\\\", \\\"max-size\\\": \\\"10m\\\"}\\n}\" > /etc/docker/daemon.json"
      echo "    && systemctl enable --now docker"
      echo "  '"
      echo ""
      echo "详细说明参考文档「5.4 手动安装 Docker（GitHub 不可达时）」章节。"
      echo "=========================================="
      exit 0  # 不阻塞后续 provision
    fi

    echo "✅ GitHub 可达，开始标准安装..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker

# 配置 Docker daemon（仅 Docker 已安装时执行）
# 关闭 iptables，docker-connector 需要
- mode: system
  script: |
    #!/bin/bash
    set -eux -o pipefail
    if ! command -v docker >/dev/null 2>&1; then
      echo "⏭️  Docker 未安装，跳过 daemon 配置"
      exit 0
    fi
    DAEMON_JSON="/etc/docker/daemon.json"
    if [ ! -f "$DAEMON_JSON" ] || ! grep -q '"iptables": false' "$DAEMON_JSON"; then
      cat > "$DAEMON_JSON" << 'EOF'
    {
      "iptables": false,
      "log-driver": "json-file",
      "log-opts": {
        "max-file": "3",
        "max-size": "10m"
      }
    }
    EOF
      systemctl restart docker
    fi

probes:
- script: |
    #!/bin/bash
    set -eux -o pipefail
    # Docker 未安装时（GitHub 不可达导致跳过），不阻塞 VM 启动
    if ! command -v docker >/dev/null 2>&1; then
      echo "⚠️  Docker 未安装，probe 跳过。请参考文档手动安装。"
      exit 0
    fi
    if ! timeout 30s bash -c "until pgrep -x dockerd; do sleep 3; done"; then
      echo >&2 "dockerd is not running"
      exit 1
    fi
  hint: |
    如果 Docker 未安装（GitHub 不可达），参考文档「5.4 手动安装 Docker（GitHub 不可达时）」章节。
    日志查看: /var/log/cloud-init-output.log

hostResolver:
  hosts:
    host.docker.internal: host.lima.internal

portForwards:
- guestSocket: "/var/run/docker.sock"
  hostSocket: "{{.Dir}}/sock/docker.sock"

message: |
  To run `docker` on the host (assumes docker-cli is installed), run the following commands:
  ------
  docker context create lima-{{.Name}} --docker "host=unix://{{.Dir}}/sock/docker.sock"
  docker context use lima-{{.Name}}
  docker run hello-world
  ------

# Ubuntu 24.04 LTS 镜像
images:
- location: "https://cloud-images.ubuntu.com/releases/noble/release/ubuntu-24.04-server-cloudimg-amd64.img"
  arch: "x86_64"
- location: "https://cloud-images.ubuntu.com/releases/noble/release/ubuntu-24.04-server-cloudimg-arm64.img"
  arch: "aarch64"

mounts:
- location: "~"
- location: "{{.GlobalTempDir}}/lima"
  mountPoint: /tmp/lima
  writable: true

# 资源配置（根据实际情况调整）
cpus: 12
memory: 20GiB
disk: 200GiB

# 关键：使用 socket_vmnet shared 网络
networks:
- lima: shared
YAML_EOF
```

### 5.2 关键配置说明

| 配置项 | 说明 | 为什么需要 |
|--------|------|------------|
| `"iptables": false` | Docker 不管理 iptables | Docker 默认会在 raw 表添加 DROP 规则，阻止 tun0 流量访问容器 |
| `networks: - lima: shared` | 启用 socket_vmnet shared 网络 | 提供稳定的外网 NAT（替代 vzNAT） |
| `cpus / memory / disk` | VM 资源 | 根据机器配置调整，建议 CPU≥4, 内存≥8GiB |

### 5.3 创建并启动 VM

```bash
# 创建并启动（名称为 docker）
limactl start --name=docker ~/lima-templates/docker.yaml

# 等待启动完成，看到 "READY" 字样
# ⚠️ 如果看到 "Docker 自动安装已跳过：无法访问 GitHub" 提示，
#    参考下方 5.4 节手动安装 Docker
```

### 5.4 手动安装 Docker（GitHub 不可达时）

> 当 `limactl start` 时因 GitHub 不可达导致 Docker 安装跳过，按本节手动安装。
> 核心思路：Docker 的 APT 仓库托管在 `download.docker.com`，国内**通常可访问**，不依赖 GitHub。

直接在 VM 内配置 Docker 官方 APT 源，绕过 `get.docker.com` 脚本：

```bash
# 进入 VM
limactl shell docker

# 1. 安装前置依赖
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# 2. 添加 Docker 官方 GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 3. 配置 Docker APT 源
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. 安装 Docker Engine 全套组件
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# 5. 配置 daemon（关闭 iptables，docker-connector 需要）
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json << 'EOF'
{
  "iptables": false,
  "log-driver": "json-file",
  "log-opts": {
    "max-file": "3",
    "max-size": "10m"
  }
}
EOF

# 6. 启动 Docker
sudo systemctl enable --now docker

# 7. 验证
sudo docker --version
sudo docker compose version
sudo docker run hello-world

# 8. 退出 VM
exit
```

> **为什么这种方式不需要 GitHub？**
> `get.docker.com` 脚本会从 GitHub Releases 下载 compose/buildx 插件的二进制文件，
> 而 APT 方式直接从 `download.docker.com` 的 deb 仓库获取所有包（包括 compose 和 buildx），完全不经过 GitHub。

### 5.5 配置 Mac 端 Docker CLI

```bash
# 安装 Docker CLI（如果未安装）
brew install docker

# 创建 Docker context 指向 Lima VM
docker context create lima-docker --docker "host=unix://$HOME/.lima/docker/sock/docker.sock"
docker context use lima-docker

# 验证
docker run hello-world
docker info | grep "Server Version"
```

### 5.6 验证网络

```bash
# 验证 lima0 网卡已分配 IP
limactl shell docker -- ip addr show lima0 | grep "inet "
# 期望: inet 192.168.105.x/24

# 验证默认路由优先走 lima0（metric 100 < eth0 的 200）
limactl shell docker -- ip route show default
# 期望: default via 192.168.105.1 dev lima0 ... metric 100

# 验证外网访问
limactl shell docker -- curl -sS -o /dev/null -w 'HTTP %{http_code} (%{time_total}s)\n' --connect-timeout 5 https://www.baidu.com
# 期望: HTTP 200

# 验证 Mac 可直接 ping 通 VM
ping -c 2 192.168.105.2
```

---

## 6. 第四步：安装 Minikube（VM 内）

### 6.1 安装 Minikube

```bash
# 进入 VM
limactl shell docker

# 安装 minikube
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-arm64
sudo install minikube-linux-arm64 /usr/local/bin/minikube
rm minikube-linux-arm64

# x86_64 架构使用:
# curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
# sudo install minikube-linux-amd64 /usr/local/bin/minikube

# 安装 kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/arm64/kubectl"
sudo install kubectl /usr/local/bin/kubectl
rm kubectl

# x86_64 架构:
# curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
```

### 6.2 启动 Minikube

```bash
# 使用 docker driver 启动（在 VM 内执行）
sudo minikube start --driver=docker --cpus=4 --memory=8192

# 验证
sudo minikube status
sudo kubectl get nodes
```

### 6.3 退出 VM

```bash
exit
```

---

## 7. 第五步：安装 docker-connector（VM 容器端）

### 7.1 启动 mac-connector 容器

在 Mac 上执行（通过 Docker CLI 操作 Lima VM 内的 Docker）：

```bash
# 拉取镜像
docker --context lima-docker pull wenjunxiao/desktop-docker-connector

# 启动容器
docker --context lima-docker run -it -d \
  --restart always \
  --net host \
  --cap-add NET_ADMIN \
  --name mac-connector \
  wenjunxiao/desktop-docker-connector
```

**参数说明**：

| 参数 | 说明 |
|------|------|
| `--restart always` | VM 重启后自动恢复 |
| `--net host` | 使用宿主机网络（才能创建 tun0） |
| `--cap-add NET_ADMIN` | 网络管理权限（创建 tun 设备、配置路由） |

### 7.2 验证 tun0 隧道

```bash
# 检查 tun0 是否已创建
limactl shell docker -- ip addr show tun0
# 期望: inet 192.168.252.1 peer 192.168.252.2/32

# 检查容器日志
docker --context lima-docker logs mac-connector
# 期望:
# interface => tun0
# command => ip addr add dev tun0 local 192.168.252.1 peer 192.168.252.2
# command => ip route add 192.168.252.0/24 via 192.168.252.2 dev tun0
```

---

## 8. 第六步：安装 docker-connector（Mac 端）

### 8.1 安装

使用 fork 增强版（推荐，包含健康检查、DNS 验证等增强功能）：

```bash
# 添加 tap
brew tap junjiewwang/brew

# 安装 docker-connector
brew install docker-connector
```

> 原版安装方式：`brew tap wenjunxiao/brew && brew install docker-connector`

### 8.2 配置路由

编辑配置文件 `$(brew --prefix)/etc/docker-connector.conf`：

```conf
# 隧道配置
addr 192.168.252.1/24
port 2521
pong on

# Docker bridge 网段路由（按需添加）
route 172.17.0.0/16
route 172.18.0.0/16
route 172.19.0.0/16
route 172.20.0.0/16
route 172.21.0.0/16
route 172.22.0.0/16
route 172.23.0.0/16
route 172.24.0.0/16
route 172.25.0.0/16

# Minikube 节点
route 192.168.49.2

# K8s Service 网段
route 10.96.0.0/16
```

> **提示**：创建新的 Docker 网络后，将其子网追加到此文件，无需重启服务即时生效：
> ```bash
> echo "route 172.30.0.0/16" >> "$(brew --prefix)/etc/docker-connector.conf"
> ```

### 8.3 启动服务

```bash
# 启动（需要 sudo，因为要操作路由表和 tun 设备）
sudo brew services start docker-connector

# 验证服务状态
sudo brew services list | grep docker-connector
# 期望: docker-connector started

# 验证路由已添加
netstat -rn | grep utun
# 期望: 172.17/16, 10.96/16, 192.168.49.2 等路由指向 utun0
```

---

## 9. 第七步：配置 VM 网络转发规则

由于 Docker `"iptables": false`，容器的 NAT 和转发需要手动配置。

### 9.1 创建网络配置脚本

```bash
# 在 VM 内创建脚本
limactl shell docker -- sudo bash -c 'cat > /root/setup-docker-network.sh << '\''SCRIPT_EOF'\'''
```

或者直接进入 VM 手动创建 `/root/setup-docker-network.sh`，核心逻辑：

```bash
#!/bin/bash
set -e

# 获取默认路由出口（自动适配 lima0 或 eth0）
PHYSICAL_IF=$(ip route | grep default | awk '{print $5}' | head -n 1)
echo "出口网卡: $PHYSICAL_IF"

# 启用 IP 转发
sudo sysctl -w net.ipv4.ip_forward=1

# 为每个 Docker 网桥配置 NAT 和转发
for bridge_info in $(docker network ls -q --filter driver=bridge | while read id; do
    name=$(docker network inspect $id --format '{{index .Options "com.docker.network.bridge.name"}}' 2>/dev/null)
    [ -z "$name" ] || [ "$name" = "<no value>" ] && name="br-${id:0:12}"
    subnet=$(docker network inspect $id --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}')
    ip link show $name &>/dev/null && echo "$name:$subnet"
done); do
    bridge=$(echo $bridge_info | cut -d: -f1)
    subnet=$(echo $bridge_info | cut -d: -f2)
    
    # NAT: 容器访问外网
    sudo iptables -t nat -C POSTROUTING -s $subnet -o $PHYSICAL_IF -j MASQUERADE 2>/dev/null || \
        sudo iptables -t nat -A POSTROUTING -s $subnet -o $PHYSICAL_IF -j MASQUERADE
    
    # FORWARD: 允许转发
    sudo iptables -C FORWARD -i $bridge -o $PHYSICAL_IF -j ACCEPT 2>/dev/null || \
        sudo iptables -A FORWARD -i $bridge -o $PHYSICAL_IF -j ACCEPT
    sudo iptables -C FORWARD -i $PHYSICAL_IF -o $bridge -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || \
        sudo iptables -A FORWARD -i $PHYSICAL_IF -o $bridge -m state --state RELATED,ESTABLISHED -j ACCEPT
    
    # tun0 转发: Mac 通过 docker-connector 访问容器
    if ip link show tun0 &>/dev/null; then
        sudo iptables -C FORWARD -i tun0 -o $bridge -j ACCEPT 2>/dev/null || \
            sudo iptables -A FORWARD -i tun0 -o $bridge -j ACCEPT
        sudo iptables -C FORWARD -i $bridge -o tun0 -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || \
            sudo iptables -A FORWARD -i $bridge -o tun0 -m state --state RELATED,ESTABLISHED -j ACCEPT
    fi
    
    echo "✅ $bridge ($subnet) 配置完成"
done

echo "✅ 网络配置完成"
```

### 9.2 执行脚本

```bash
limactl shell docker -- sudo bash /root/setup-docker-network.sh
```

> ⚠️ 注意：此脚本在 VM 重启后需要重新执行，可考虑加入 systemd service 或 rc.local 实现开机自动执行。

---

## 10. 验证清单

所有步骤完成后，逐项验证：

```bash
# ① VM 外网访问（走 socket_vmnet 稳定 NAT）
limactl shell docker -- curl -sS -o /dev/null -w 'HTTP %{http_code} (%{time_total}s)\n' https://www.baidu.com
# 期望: HTTP 200

# ② Mac 直接 ping VM 的 shared IP
ping -c 2 192.168.105.2
# 期望: 0% packet loss

# ③ Mac 直接 ping Docker 容器 IP
docker --context lima-docker run -d --name test-nginx nginx
NGINX_IP=$(docker --context lima-docker inspect test-nginx --format '{{.NetworkSettings.IPAddress}}')
ping -c 2 $NGINX_IP
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://$NGINX_IP
# 期望: 0% packet loss, HTTP 200
docker --context lima-docker rm -f test-nginx

# ④ Mac 访问 Docker 容器（通过 docker-connector）
netstat -rn | grep utun | head -5
# 期望: 172.17/16 等网段路由存在

# ⑤ Minikube K8s 集群
limactl shell docker -- sudo kubectl get nodes
# 期望: STATUS=Ready

# ⑥ Mac 访问 K8s Service（通过 docker-connector）
limactl shell docker -- sudo kubectl get svc -A | head -5
# 可以从 Mac curl 10.96.0.1:443（API Server）

# ⑦ Docker 容器访问外网
docker --context lima-docker run --rm curlimages/curl curl -sS -o /dev/null -w 'HTTP %{http_code}\n' https://www.baidu.com
# 期望: HTTP 200
```

---

## 11. 常见问题排查

### Q1: limactl sudoers 报错 "file is not owned by root"

**原因**：socket_vmnet 二进制不是 root 拥有。

**解决**：确认使用源码安装方式，检查 `ls -la /opt/socket_vmnet/bin/socket_vmnet` 所有者为 `root:wheel`。

### Q2: lima0 未分配 IP

**原因**：macOS 防火墙阻止了 DHCP。

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/libexec/bootpd
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblock /usr/libexec/bootpd
```

### Q3: Mac 无法 ping 通容器 IP

**排查步骤**：

```bash
# 1. 检查 docker-connector 服务
ps aux | grep docker-connector | grep -v grep

# 2. 检查路由表
netstat -rn | grep utun

# 3. 检查 VM 内 mac-connector 容器
docker --context lima-docker ps | grep mac-connector

# 4. 检查 VM 内 iptables FORWARD 规则
limactl shell docker -- sudo iptables -L FORWARD -n -v

# 5. 检查 VM 内 NAT 规则
limactl shell docker -- sudo iptables -t nat -L POSTROUTING -n -v
```

### Q4: 容器无法访问外网

**排查**：

```bash
# 检查 VM 默认路由
limactl shell docker -- ip route show default
# lima0 应该 metric 最小（优先级最高）

# 检查 NAT 规则是否存在
limactl shell docker -- sudo iptables -t nat -L POSTROUTING -n
# 应有 MASQUERADE 规则

# 如果缺少，重新执行网络配置脚本
limactl shell docker -- sudo bash /root/setup-docker-network.sh
```

### Q5: Docker 的 `"iptables": false` 为什么是必要的？

Docker 开启 iptables 管理后，会在 raw 表为容器添加 `NOTRACK` 和 `DROP` 规则，阻止来自非 Docker 管理的网络接口（如 tun0）的流量访问容器。docker-connector 的 tun0 隧道流量会被这些规则丢弃。

关闭 Docker iptables 后，需要通过 `setup-docker-network.sh` 脚本手动管理 NAT 和 FORWARD 规则。

### Q6: VM 启动后发现 Docker 未安装

**原因**：`limactl start` 过程中因 GitHub 不可达，provision 脚本自动跳过了 Docker 安装。

**确认方式**：

```bash
# 进入 VM 检查
limactl shell docker -- docker --version
# 如果报 "command not found" 说明 Docker 未安装

# 查看 provision 日志确认原因
limactl shell docker -- grep -A5 "GitHub" /var/log/cloud-init-output.log
```

**解决**：参考 **5.4 手动安装 Docker（GitHub 不可达时）** 章节，通过 APT 源安装即可。

---

## 12. 日常操作速查

### 12.1 VM 管理

```bash
limactl start docker     # 启动 VM
limactl stop docker      # 停止 VM
limactl shell docker     # 进入 VM shell
limactl list             # 查看 VM 状态
```

### 12.2 Docker 操作

```bash
# Mac 上直接使用（已配置 context）
docker ps
docker compose up -d

# 或显式指定 context
docker --context lima-docker ps
```

### 12.3 Minikube 操作

```bash
limactl shell docker -- sudo minikube start    # 启动 K8s
limactl shell docker -- sudo minikube stop     # 停止 K8s
limactl shell docker -- sudo minikube status   # 状态
limactl shell docker -- sudo kubectl get pods  # 查看 Pod
```

### 12.4 网络维护

```bash
# 添加新的 Docker 网络路由
echo "route 172.30.0.0/16" >> "$(brew --prefix)/etc/docker-connector.conf"
# 无需重启，热加载生效

# VM 重启后重新配置网络规则
limactl shell docker -- sudo bash /root/setup-docker-network.sh
```

---

## 13. 完整版本信息

| 组件 | 版本 | 安装方式 |
|------|------|----------|
| macOS | 15.5 (Sequoia) | - |
| Lima | v1.1.1 | `brew install lima` |
| socket_vmnet | v1.2.1 | 源码编译安装到 `/opt/socket_vmnet` |
| Docker Engine | 28.5.1 | VM 内 `get.docker.com` 自动安装 |
| docker-connector (Mac) | brew 最新版 | `brew install docker-connector` |
| mac-connector (VM) | latest | `docker pull wenjunxiao/desktop-docker-connector` |
| Ubuntu | 24.04 LTS (Noble) | Lima VM 基础镜像 |
| Minikube | latest | VM 内手动安装 |

---

*最后更新：2026-03-30*
