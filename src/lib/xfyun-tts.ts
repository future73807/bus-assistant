import crypto from 'crypto';
import WebSocket from 'ws';

export async function synthesizeSpeechXfyun(text: string, appId: string, apiSecret: string, apiKey: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = new URL("wss://tts-api.xfyun.cn/v2/tts");
    const host = url.host;
    const date = new Date().toUTCString();
    
    // 1. Generate Signature
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
    const signature = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
    
    const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');
    
    // IMPORTANT: authorization contains special characters like '+', '/', '=' which MUST be encoded for URL query params
    const finalUrl = `${url.toString()}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${host}`;
    
    // 2. Connect WebSocket
    const ws = new WebSocket(finalUrl);
    
    const audioData: Buffer[] = [];
    
    ws.on('open', () => {
        const frame = {
            common: {
                app_id: appId
            },
            business: {
                aue: "lame", // mp3
                sfl: 1,
                auf: "audio/L16;rate=16000",
                vcn: "x4_yezi", // 多方言免切换音色
                speed: 50,
                volume: 50,
                pitch: 50,
                bgs: 0,
                tte: "UTF8"
            },
            data: {
                status: 2,
                text: Buffer.from(text).toString('base64')
            }
        };
        ws.send(JSON.stringify(frame));
    });
    
        ws.on('message', (data: WebSocket.Data) => {
        let res;
        try {
             res = JSON.parse(data.toString());
        } catch (e) {
             console.error("Xfyun JSON Parse Error:", e);
             return;
        }

        if (res.code !== 0) {
            ws.close();
            reject(new Error(`Xfyun API Error: ${res.code} ${res.message}`));
            return;
        }
        
        if (res.data && res.data.audio) {
            const buffer = Buffer.from(res.data.audio, 'base64');
            audioData.push(buffer);
        }
        
        if (res.data && res.data.status === 2) {
            ws.close();
            resolve(Buffer.concat(audioData));
        }
    });
    
    ws.on('error', (error: Error) => {
        reject(error);
    });
    
    ws.on('close', (code: number, reason: Buffer) => {
        if (audioData.length > 0) {
             // Sometimes close happens before status=2 in some conditions, but usually we rely on status=2
             // resolve(Buffer.concat(audioData));
        }
    });
  });
}
