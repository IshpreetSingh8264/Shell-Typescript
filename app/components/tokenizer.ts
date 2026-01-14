/**
 The Tokenizer: Where strings go to get chopped up like a bad breakup (Personal Experience :(( )
  
 This function takes the users command line input and splits it into digestible pieces.
 A food processor, but for text. And less dangerous. Probably (HOPEFULLY LOL).
 
 */



export function tokenizer(input: string):string[] {

    const tokens = []; // The collection of words
    let currentToken = ''; // The token we are currently building
    let inSingleQuote = false; // Are we in single quote?
    let inDoubleQuote = false; // Are we in double quote?
    let i = 0; // The position in the string (basically "Sanchar Saathi" for characters (govt tracking u, high level ball knowledge required to understand))
    let wasQuoted = false; // Did this token come from quotes? Important for empty things (strings) like my soul

    // The VIP operators club, these bad boys get their own tokens
    const operators = new Set(['&&', '||', ';', '|', '&']);
    // The redirect operators, for when the data needs directions
    const redirectOps = new Set(['<<', '>>', '>&', '&>', '<&', '2>&1', '2>', '1>', '1>>', '2>>']);

    while (i < input.length) {
        const char = input[i]; // Current character, our main protagonist

        // QUOTE HANDLING: The "it's complicated" relationship status of parsing (I hope you see what I did there)
        if (char === "'" && !inDoubleQuote) {
            // Single quote toggle - like a light switch but for string boundaries
            inSingleQuote = !inSingleQuote;
            wasQuoted = true; // Remember this moment
            i++;
            continue; // Move along, nothing to see here
        } else if (char === '"' && !inSingleQuote) {
            // Double quote toggle - single quote's big bro
            inDoubleQuote = !inDoubleQuote;
            wasQuoted = true;
            i++;
            continue;
        } else if (char === '\\' && !inSingleQuote) {
            // BACKSLASH: The escape artist of the character world
            if (inDoubleQuote) {
                // Inside double quotes, only certain characters can be escaped
                // It's like VIP access but for backslash victims only
                if (i + 1 < input.length && ['\\', '"', '$'].includes(input[i + 1])) {
                    currentToken += input[i + 1]; // Take the next char literally
                    i += 2; // Skip both the backslash and its friend
                    continue;
                }
            } else {
                // Outside quotes, backslash is the ultimate escape room
                // ANY character can be escaped. Even emojis. Living the dream.
                if (i + 1 < input.length) {
                    currentToken += input[i + 1];
                    i += 2;
                    continue;
                }
            }
        } else if (!inSingleQuote && !inDoubleQuote) {
            // FREEDOM! We're not trapped in quotes, let's do normal stuff (I hated writing the quote logic ;-;)
            
            if (/\s/.test(char)) {
                // WHITESPACE: The token separator, the word boundary, the space... space
                if (currentToken.length > 0 || wasQuoted) {
                    tokens.push(currentToken); // Ship it!
                    currentToken = ''; // Start fresh like she did after our last date
                    wasQuoted = false;
                }
                i++;
                continue;
            } else if (char === '#' && currentToken.length === 0 && (i === 0 || /\s/.test(input[i - 1]))) {
                // COMMENT TIME: Everything after this is ignored, like my opinions
                // But ONLY if # appears at start or after whitespace (test#value is NOT a comment)
                break; // Peace out, we're done here
            } else {
                // OPERATOR DETECTION: The "check from longest to shortest" dance
                // Because '>>' should be one token, not two '>' tokens having an existential crisis
                const fourCharOp = input.slice(i, i + 4);
                const threeCharOp = input.slice(i, i + 3);
                const twoCharOp = input.slice(i, i + 2);

                if (redirectOps.has(fourCharOp)) {
                    // Found a 4-char operator! Rare and beautiful like a unicorn
                    if (currentToken.length > 0) {
                        tokens.push(currentToken);
                        currentToken = '';
                    }
                    tokens.push(fourCharOp);
                    i += 4; // Big jump! Wheee!
                    continue;
                } else if (redirectOps.has(threeCharOp)) {
                    // 3-char operator detected! Less rare but still cool
                    if (currentToken.length > 0) {
                        tokens.push(currentToken);
                        currentToken = '';
                    }
                    tokens.push(threeCharOp);
                    i += 3;
                    continue;
                } else if (redirectOps.has(twoCharOp) || operators.has(twoCharOp)) {
                    // 2-char operator! The most common of the multi-char operators
                    if (currentToken.length > 0) {
                        tokens.push(currentToken);
                        currentToken = '';
                    }
                    tokens.push(twoCharOp);
                    i += 2;
                    continue;
                } else if (operators.has(char) || ['>', '<'].includes(char)) {
                    // Single-char operator. Simple. Elegant. Like a haiku.
                    if (currentToken.length > 0) {
                        tokens.push(currentToken);
                        currentToken = '';
                    }
                    tokens.push(char);
                    i++;
                    continue;
                }
            }
        }

        // If we made it here, this character is just a regular Joe
        // Add it to our current token and keep moving
        currentToken += char;
        i++;
    }

    // Final token check - don't forget the last one!
    // (Like checking under the couch cushions for loose change)
    if (currentToken.length > 0 || wasQuoted) {
        tokens.push(currentToken);
    }

    // VALIDATION: The moment of truth
    if (inSingleQuote || inDoubleQuote) {
        // Oh no! Unclosed quote! Someone forgot to close their string!
        // This is like leaving the door open but for quotes
        throw new Error("Unmatched quote");
    } else {
        // Success! Return the fruits of our labor
        return tokens;
    }

};