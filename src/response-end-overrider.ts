import { Response } from 'express';
/**
 * this function will override before response end
 * @param res Express Response
 * @param overrideFn Override Function that trigger before res.end
 */
export const responseEndOverrider = (res: Response, overrideFn: (resBody: string) => void) => {
  const defEnd = res.end;
  const defWrite = res.write;
  const chunks: Buffer[] = [];

  res.write = ((...args: any): void => {
    chunks.push(Buffer.from(args[0]));
    defWrite.apply(res, args);
  }) as any;

  res.end = (async (...args: any): Promise<void> => {
    if (args[0]) {
      chunks.push(Buffer.from(args[0]));
    }

    const resBody = Buffer.concat(chunks).toString('utf8');
    await overrideFn(resBody);

    defEnd.apply(res, args);
  }) as any;
};
