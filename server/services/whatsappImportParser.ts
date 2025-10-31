import { z } from 'zod';

export interface ParsedMessage {
  timestamp: Date;
  sender: string;
  content: string;
  direction: 'inbound' | 'outbound';
}

export interface ParseResult {
  messages: ParsedMessage[];
  errors: string[];
  totalLines: number;
  parsedLines: number;
}

const ITALIAN_MONTHS = {
  'gen': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mag': 4, 'giu': 5,
  'lug': 6, 'ago': 7, 'set': 8, 'ott': 9, 'nov': 10, 'dic': 11
};

export class WhatsAppImportParser {
  private agentNames: string[] = ['Tu', 'You'];
  
  constructor(agentNames?: string[]) {
    if (agentNames && agentNames.length > 0) {
      this.agentNames = agentNames;
    }
  }

  parse(fileContent: string, clientName: string): ParseResult {
    const lines = fileContent.split('\n');
    const messages: ParsedMessage[] = [];
    const errors: string[] = [];
    let currentMessage: ParsedMessage | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;
      
      if (line.includes('I messaggi e le chiamate sono protetti')) continue;
      if (line.includes('encryption')) continue;

      const messageMatch = this.parseMessageLine(line, clientName);
      
      if (messageMatch) {
        if (currentMessage) {
          messages.push(currentMessage);
        }
        currentMessage = messageMatch;
      } else if (currentMessage && line.length > 0) {
        currentMessage.content += '\n' + line;
      } else if (line.length > 0) {
        errors.push(`Line ${i + 1}: Unable to parse - ${line.substring(0, 100)}`);
      }
    }

    if (currentMessage) {
      messages.push(currentMessage);
    }

    return {
      messages,
      errors,
      totalLines: lines.length,
      parsedLines: messages.length
    };
  }

  private parseMessageLine(line: string, clientName: string): ParsedMessage | null {
    const patterns = [
      /^(\d{2})\/(\d{2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})\s*-\s*([^:]+):\s*(.*)$/,
      /^(\d{2})\/(\d{2})\/(\d{2,4}),?\s+(\d{1,2})\.(\d{2})\s*-\s*([^:]+):\s*(.*)$/,
      /^\[(\d{2})\/(\d{2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\]\s+([^:]+):\s*(.*)$/,
      /^(\d{1,2})\s+(\w{3})\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*-\s*([^:]+):\s*(.*)$/
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        try {
          const timestamp = this.parseTimestamp(match);
          const sender = match[match.length - 2].trim();
          const content = match[match.length - 1].trim();

          if (!content || content === '<Media omessi>' || content === '<Media omitted>') {
            return null;
          }

          const isAgent = this.agentNames.some(name => 
            sender.toLowerCase().includes(name.toLowerCase())
          );

          return {
            timestamp,
            sender,
            content,
            direction: isAgent ? 'outbound' : 'inbound'
          };
        } catch (error) {
          return null;
        }
      }
    }

    return null;
  }

  private parseTimestamp(match: RegExpMatchArray): Date {
    if (match.length >= 8 && ITALIAN_MONTHS[match[2].toLowerCase()]) {
      const day = parseInt(match[1]);
      const month = ITALIAN_MONTHS[match[2].toLowerCase()];
      const year = parseInt(match[3]);
      const hour = parseInt(match[4]);
      const minute = parseInt(match[5]);
      
      return new Date(year, month, day, hour, minute);
    }

    let day = parseInt(match[1]);
    let month = parseInt(match[2]) - 1;
    let year = parseInt(match[3]);
    
    if (year < 100) {
      year += 2000;
    }
    
    const hour = parseInt(match[4]);
    const minute = parseInt(match[5]);

    return new Date(year, month, day, hour, minute);
  }

  parseJSON(jsonContent: string): ParseResult {
    try {
      const data = JSON.parse(jsonContent);
      const messages: ParsedMessage[] = [];
      const errors: string[] = [];

      if (!Array.isArray(data)) {
        return {
          messages: [],
          errors: ['Invalid JSON format: expected array of messages'],
          totalLines: 0,
          parsedLines: 0
        };
      }

      for (const msg of data) {
        try {
          const timestamp = new Date(msg.timestamp || msg.date || msg.time);
          const content = msg.content || msg.message || msg.text;
          const sender = msg.sender || msg.from || msg.author;

          if (!content || !sender) {
            errors.push(`Skipping message: missing content or sender`);
            continue;
          }

          const isAgent = this.agentNames.some(name => 
            sender.toLowerCase().includes(name.toLowerCase())
          );

          messages.push({
            timestamp,
            sender,
            content,
            direction: isAgent ? 'outbound' : 'inbound'
          });
        } catch (error) {
          errors.push(`Failed to parse message: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return {
        messages,
        errors,
        totalLines: data.length,
        parsedLines: messages.length
      };
    } catch (error) {
      return {
        messages: [],
        errors: [`JSON parse error: ${error instanceof Error ? error.message : String(error)}`],
        totalLines: 0,
        parsedLines: 0
      };
    }
  }
}

export const whatsappImportParser = new WhatsAppImportParser();
