# 安装，操作一次即可
# npm install pm2 -g
# 进入当前文件所在目录（项目目录）
this_dir=$(dirname "$0")
cd "$this_dir"
# 启动你的标注服务
pm2 start $this_dir/server.mjs --name bitable-annotator
# 设置容器重启自动拉起（pm2自启）
pm2 startup
# 把当前所有正在由 PM2 托管运行的应用，完整快照保存到文件 ~/.pm2/dump.pm2。
# 下次开机 PM2 启动后，自动执行 pm2 resurrect，读取 dump.pm2，把里面存的所有应用全部重新启动。
pm2 save


# # 后续可选操作
# # 查看pm2守护的所有进程的状态
# pm2 status
# # 查看指定服务进程的日志
# pm2 logs bitable-annotator -f
# pm2 logs bitable-annotator
# # 重启/停止
# pm2 restart bitable-annotator
# pm2 stop bitable-annotator