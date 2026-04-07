import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// Helper function to run a single python script
const runPythonScript = (scriptName: string) => {
  return new Promise<{ success: boolean; stdout: string; stderr: string }>((resolve) => {
    // Determine python path: use environment variable or default to 'python3' for Vercel
    const pythonPath = process.env.NODE_ENV === 'production' ? 'python3' : 'python';
    const scriptPath = path.join(process.cwd(), scriptName);

    console.log(`Executing ${scriptName}...`);
    const proc = spawn(pythonPath, [scriptPath]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => (stdout += data.toString()));
    proc.stderr.on('data', (data) => (stderr += data.toString()));

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
      });
    });
  });
};

export async function GET(request: NextRequest) {
  // Simple check for cron (optional, can be expanded for security)
  const isCron = request.nextUrl.searchParams.get('cron') === 'true';

  if (!isCron) {
    return NextResponse.json({ error: 'Unauthorized or not a cron trigger' }, { status: 401 });
  }

  try {
    const scripts = ['data_loader.py', 'model.py', 'predict.py'];
    const results = [];

    for (const script of scripts) {
      const res = await runPythonScript(script);
      results.push({ script, ...res });
      if (!res.success) {
        return NextResponse.json({ error: `${script} failed`, results }, { status: 500 });
      }
    }

    return NextResponse.json({ message: 'All scripts executed successfully', results });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json();

    if (!['data_loader.py', 'model.py', 'predict.py'].includes(script)) {
      return NextResponse.json({ error: 'Invalid script name' }, { status: 400 });
    }

    const res = await runPythonScript(script);

    if (res.success) {
      return NextResponse.json({ message: `${script} executed successfully`, stdout: res.stdout });
    } else {
      return NextResponse.json({ error: `${script} failed`, stderr: res.stderr, stdout: res.stdout }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
