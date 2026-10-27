declare module '@stealthybox/jpg-stream/decoder' {
    interface JPEGDecoderOptions {
        width?: number;
        height?: number;
    }

    class JPEGDecoder {
        constructor(options?: JPEGDecoderOptions);

        on(event: string, callback: (...args: any[]) => void): void;
        end(data: Uint8Array): void;
    }

    export default JPEGDecoder;
}