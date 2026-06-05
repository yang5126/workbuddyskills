# 环境配置完整映射

## 煤炭 (mt)

| 属性 | 正式 | 测试 |
|------|------|------|
| key | mt | mt_test |
| 项目路径 | `C:/Users/yg/IdeaProjects/scm_mt_server` | 同正式 |
| JAR 路径 | `C:/Users/yg/IdeaProjects/scm_mt_server/target/gdt_mt.jar` | 同正式 |
| Maven 打包 | `mvn clean package -DskipTests` | 同正式 |
| Base URL | `http://10.237.1.31:8022` | `http://10.237.1.32:8022` |
| 服务路径 | `/data/gdt_home/gdt_mt/server` | `/data/gdt_home/gdt_mt/server` |
| 重启命令 | `sh reStart-mt.sh` | `sh reStart-mt.sh` |
| 登录密码 | `Spic@1455cs` | `Spic@1455cs` |
| 登录账户 | `Admin` | `Admin` |

## 铝业 (ly)

| 属性 | 正式 | 测试 |
|------|------|------|
| key | ly | ly_test |
| 项目路径 | `C:/Users/yg/IdeaProjects/scm_ly_server` | 同正式 |
| JAR 路径 | `C:/Users/yg/IdeaProjects/scm_ly_server/target/gdt_ly.jar` | 同正式 |
| Maven 打包 | `mvn clean package -DskipTests` | 同正式 |
| Base URL | `http://10.237.1.31:8044` | `http://10.237.1.32:8033/gdt_server` |
| 服务路径 | `/data/gdt_home/gdt_ly/server` | `/data/gdt_home/gdt_ly/server` |
| 重启命令 | `sh reStart-ly.sh` | `sh reStart-ly.sh` |
| 登录密码 | `SPICly@1455` | `SPICly@1455` |
| 登录账户 | `Admin` | `Admin` |

## 陆港 (lg)

| 属性 | 正式 | 测试 |
|------|------|------|
| key | lg | lg_test |
| 项目路径 | `C:/Users/yg/IdeaProjects/scm_lg_server` | 同正式 |
| JAR 路径 | `C:/Users/yg/IdeaProjects/scm_lg_server/target/gdt_lg.jar` | 同正式 |
| Maven 打包 | `mvn clean package -DskipTests` | 同正式 |
| Base URL | `http://10.237.1.31:8066` | `http://10.237.1.32:8066` |
| 服务路径 | `/data/gdt_home/gdt_lg/server` | `/data/gdt_home/gdt_lg/server` |
| 重启命令 | `sh reStart-lg.sh` | `sh reStart-lg.sh` |
| 登录密码 | `Spic@1455` | `Spic@1455` |
| 登录账户 | `Admin` | `Admin` |

## 快速对照表

```
煤炭: mt(正式:8022/gdt_mt/server)  mt_test(测试:32:8022/gdt_mt/server)
铝业: ly(正式:8044/gdt_ly/server)  ly_test(测试:32:8033/gdt_server/gdt_ly/server)
陆港: lg(正式:8066/gdt_lg/server)  lg_test(测试:32:8066/gdt_lg/server)
```

重启脚本均在工作目录下执行 `sh reStart-{产业}.sh`。

## 前端 Web 部署路径

| 产业 | 正式/测试 | 目标路径 |
|------|----------|---------|
| 煤炭 | mt/mt_test | `/data/gdt_home/gdt_mt/web/dist/` |
| 铝业 | ly/ly_test | `/data/gdt_home/gdt_ly/web/dist/` |
| 陆港 | lg/lg_test | `/data/gdt_home/gdt_lg/web/dist/` |

前端构建脚本统一为各项目的 `scripts/idea/build-prod.cmd`。
