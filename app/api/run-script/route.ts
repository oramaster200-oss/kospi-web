import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json();

    if (!['data_loader.py', 'model.py', 'predict.py'].includes(script)) {
      return NextResponse.json({ error: 'Invalid script name' }, { status: 400 });
    }

    const pythonPath = 'C:\\Users\\mini\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';
    const scriptPath = path.join(process.cwd(), script);

    return new Promise<NextResponse>((resolve) => {
      const process = spawn(pythonPath, [scriptPath]);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`stdout: ${data}`);
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(`stderr: ${data}`);
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(NextResponse.json({ message: `${script} executed successfully`, stdout }));
        } else {
          resolve(NextResponse.json({ error: `${script} failed with code ${code}`, stderr, stdout }, { status: 500 }));
        }
      });
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
