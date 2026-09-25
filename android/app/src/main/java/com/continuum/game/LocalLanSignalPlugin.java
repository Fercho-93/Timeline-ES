package com.continuum.game;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

@CapacitorPlugin(name = "LocalLanSignal")
public class LocalLanSignalPlugin extends Plugin {
  private ServerSocket server; private ExecutorService executor; private String token; private int port;

  @PluginMethod public void start(PluginCall call) {
    stopServer(); token = call.getString("token", ""); port = call.getInt("port", 8765);
    try {
      server = new ServerSocket(); server.setReuseAddress(true); server.bind(new InetSocketAddress("0.0.0.0", port));
      executor = Executors.newCachedThreadPool(); executor.submit(this::acceptLoop); call.resolve();
    } catch (Exception e) { stopServer(); call.reject("LAN_START_FAILED", e); }
  }
  @PluginMethod public void stop(PluginCall call) { stopServer(); call.resolve(); }
  @Override protected void handleOnDestroy() { stopServer(); super.handleOnDestroy(); }

  @PluginMethod public void getAddress(PluginCall call) {
    try { JSObject out = new JSObject(); out.put("address", localIPv4()); out.put("port", port); call.resolve(out); }
    catch (Exception e) { call.reject("LAN_ADDRESS_FAILED", e); }
  }

  @PluginMethod public void sendAnswer(PluginCall call) {
    String host=call.getString("host"), secret=call.getString("token"), answer=call.getString("answer"), peerId=call.getString("peerId", ""); int p=call.getInt("port",8765);
    executorForClient().submit(() -> {
      try {
        URL url=new URL("http",host,p,"/answer"); HttpURLConnection c=(HttpURLConnection)url.openConnection(); c.setConnectTimeout(5000); c.setReadTimeout(5000); c.setDoOutput(true); c.setRequestMethod("POST"); c.setRequestProperty("Content-Type","application/json");
        JSONObject body=new JSONObject(); body.put("token",secret); body.put("answer",answer); body.put("peerId",peerId);
        try(OutputStream os=c.getOutputStream()){os.write(body.toString().getBytes(StandardCharsets.UTF_8));}
        int status=c.getResponseCode(); c.disconnect(); if(status>=200&&status<300) call.resolve(); else call.reject("LAN_SEND_FAILED_"+status);
      } catch(Exception e){call.reject("LAN_SEND_FAILED",e);}
    });
  }

  private ExecutorService executorForClient(){ if(executor==null||executor.isShutdown()) executor=Executors.newCachedThreadPool(); return executor; }
  private void acceptLoop(){ while(server!=null&&!server.isClosed()) try { Socket s=server.accept(); executor.submit(()->handle(s)); } catch(Exception ignored){} }
  private void handle(Socket socket){
    try(socket){ socket.setSoTimeout(5000); BufferedReader r=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.UTF_8)); String first=r.readLine(); if(first==null||!first.startsWith("POST /answer ")){reply(socket,404);return;} int len=0; String line; while((line=r.readLine())!=null&&!line.isEmpty()){ if(line.toLowerCase(Locale.ROOT).startsWith("content-length:")) len=Integer.parseInt(line.substring(15).trim()); } char[] buf=new char[Math.max(0,len)]; int off=0,n; while(off<len&&(n=r.read(buf,off,len-off))>0)off+=n; JSONObject body=new JSONObject(new String(buf,0,off)); if(!token.equals(body.optString("token"))){reply(socket,403);return;} JSObject event=new JSObject(); event.put("token",token); event.put("answer",body.optString("answer")); event.put("peerId",body.optString("peerId")); notifyListeners("answer",event); reply(socket,204);
    }catch(Exception ignored){}
  }
  private void reply(Socket s,int status)throws IOException{ String text=status==204?"No Content":status==403?"Forbidden":"Not Found"; byte[] b=("HTTP/1.1 "+status+" "+text+"\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII); s.getOutputStream().write(b); }
  private String localIPv4() throws Exception { Enumeration<NetworkInterface> ns=NetworkInterface.getNetworkInterfaces(); while(ns.hasMoreElements()){NetworkInterface ni=ns.nextElement(); if(!ni.isUp()||ni.isLoopback())continue; Enumeration<InetAddress> as=ni.getInetAddresses(); while(as.hasMoreElements()){InetAddress a=as.nextElement(); if(a instanceof Inet4Address&&!a.isLoopbackAddress()&&a.isSiteLocalAddress())return a.getHostAddress();}} throw new IOException("NO_LAN_ADDRESS"); }
  private void stopServer(){ try{if(server!=null)server.close();}catch(Exception ignored){} server=null; if(executor!=null)executor.shutdownNow(); executor=null; }
}
