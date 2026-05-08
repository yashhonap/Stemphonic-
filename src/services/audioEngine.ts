/**
 * AudioEngine Service
 * Implements various techniques for stem separation and processing
 */

export class AudioEngine {
  private context: AudioContext;
  private source: AudioBufferSourceNode | null = null;
  private vocalGain: GainNode;
  private musicGain: GainNode;
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;
  
  constructor() {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.vocalGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.splitter = this.context.createChannelSplitter(2);
    this.merger = this.context.createChannelMerger(2);
    
    // Connect gains to destination
    this.vocalGain.connect(this.context.destination);
    this.musicGain.connect(this.context.destination);
  }

  async loadAudio(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await this.context.decodeAudioData(arrayBuffer);
  }

  /**
   * Simple but effective Center Channel Extraction
   * This technique extracts vocals (center) and music (sides)
   */
  process(buffer: AudioBuffer) {
    if (this.source) {
      this.source.stop();
    }

    this.source = this.context.createBufferSource();
    this.source.buffer = buffer;

    // Create the separation graph
    // Path 1: Instrumental (Center Cancellation)
    // Instrumental = L - R
    const leftToInstrumental = this.context.createGain();
    const rightToInstrumental = this.context.createGain();
    rightToInstrumental.gain.value = -1; // Invert phase

    // Path 2: Vocals (Center Extraction)
    // Vocals ≈ L + R (with high-pass and low-pass to focus on human voice)
    const voiceFilter = this.context.createBiquadFilter();
    voiceFilter.type = "bandpass";
    voiceFilter.frequency.value = 1000;
    voiceFilter.Q.value = 0.5;

    // Conntecting...
    this.source.connect(this.splitter);
    
    // Instrumental Path
    this.splitter.connect(leftToInstrumental, 0);
    this.splitter.connect(rightToInstrumental, 1);
    
    leftToInstrumental.connect(this.musicGain);
    rightToInstrumental.connect(this.musicGain);

    // Vocal Path (Simulated - actually quite hard without ML, but we'll use a focus filter)
    this.source.connect(voiceFilter);
    voiceFilter.connect(this.vocalGain);

    this.source.start();
  }

  setVocalVolume(value: number) {
    this.vocalGain.gain.setTargetAtTime(value, this.context.currentTime, 0.1);
  }

  setMusicVolume(value: number) {
    this.musicGain.gain.setTargetAtTime(value, this.context.currentTime, 0.1);
  }

  stop() {
    this.source?.stop();
  }
}
