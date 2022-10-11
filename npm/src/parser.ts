import type { Options } from './main';

function parseStringAsRegex(arg: string) {
    if (!/\/.+\/[a-zA-Z]*/.test(arg)) {
        throw new Error(`Expected regex, got: '${arg}'`);
    }

    const indexOfEndingSlash = arg.lastIndexOf('/');
    const flags = arg.slice(indexOfEndingSlash + 1);

    if (flags !== 'i' && flags !== '') {
        throw new Error(
            `The only regex flag allowed is 'i'. Recieved: '${flags}'`
        );
    }

    try {
        return new RegExp(arg.slice(1, indexOfEndingSlash), flags);
    } catch (e) {
        throw new Error(
            `Tried to parse "${arg}" as a regex, failed with: ` +
                (e as Error)?.message
        );
    }
}

/**
 * Takes in a string of arguments and outputs an array for `parseArgsIntoOptions()`.
 *
 * ```js
 * tokenizeArgString('--random --hi there you -su');
 * // => ['--random', '--hi', 'there', 'you', '-su']
 * ```
 */
export function tokenizeArgString(argString: string): string[] {
    const args: string[] = [];

    let opening = '';
    let currentArgIndex = 0;

    for (let i = 0; i < argString.length; i++) {
        const char = argString[i];

        if (typeof args[currentArgIndex] === 'undefined') {
            args[currentArgIndex] = '';
        }

        if (/\s/.test(char) && !opening) {
            if (args[currentArgIndex]) {
                currentArgIndex++;
            }

            continue;
        }

        if ((char === '"' || char === "'") && argString[i - 1] !== '\\') {
            if (!opening) {
                opening = char;
                continue;
            } else if (opening === char) {
                currentArgIndex++;
                opening = '';
                continue;
            }
        }

        if (
            char === '\\' &&
            (argString[i + 1] === "'" || argString[i + 1] === '"') &&
            argString[i + 1] === opening
        ) {
            args[currentArgIndex] += argString[i + 1];
            i++;
            continue;
        }

        args[currentArgIndex] += char;
    }

    return args;
}

/**
 * Takes in an array of arguments and parses it into options for `sort()`.
 */
export function parseArgsIntoOptions(
    args: string[],
    unknownArgCallback?: (args: string[], index: number, options: Options) => {}
) {
    const options: Options = {};
    const positionals: string[] = [];
    const errors: string[] = [];

    // from https://stackoverflow.com/a/67243723/
    const kebabize = (str: string) =>
        str.replace(
            /[A-Z]+(?![a-z])|[A-Z]/g,
            ($, ofs) => (ofs ? '-' : '') + $.toLowerCase()
        );

    function setSorter(sorter: Options['sorter']) {
        if (options.sorter) {
            errors.push("Can't have more than one sorter");
        }

        options.sorter = sorter;
    }

    function requireNextArg(currentIndex: number) {
        if (args.length <= currentIndex + 1) {
            errors.push(args[currentIndex] + ' requires an argument');
            return false;
        }

        return true;
    }

    for (let i = 0; i < args.length; i++) {
        let arg = kebabize(args[i]);

        if (!arg.startsWith('--') && !arg.startsWith('-')) {
            positionals.push(arg);
            continue;
        }

        // parses short hand option groups like -su or -s3u
        if (arg.length !== 2 && /^-[a-zA-Z]/.test(arg)) {
            const shortHandOptions = arg.match(/[a-zA-Z][^a-zA-Z]*/g);

            if (shortHandOptions && shortHandOptions.length > 0) {
                args.splice(i, 1, ...shortHandOptions.map((e) => '-' + e));
                i--;
                continue;
            }
        }

        let assumedBoolValue = true;
        let consumedBool = false;
        let matchedCase = true;

        if (arg.startsWith('--no-')) {
            assumedBoolValue = false;
            arg = arg.replace('--no-', '--');

            if (arg.length === 3) {
                arg = arg.slice(1);
            }
        }

        switch (arg) {
            case '--case-insensitive':
            case '-i':
                setSorter('case-insensitive');
                break;
            case '--natural-sort':
            case '-e':
                setSorter('natural');
                break;
            case '--numerical-sort':
            case '-n':
                setSorter('numerical');
                break;
            case '--float-sort':
            case '-f':
                setSorter('float');
                break;
            case '--length-sort':
            case '-l':
                setSorter('length');
                break;
            case '--random-sort':
            case '-z':
                setSorter('random');
                break;
            case '--recursive':
            case '-r':
                options.recursive = assumedBoolValue;
                consumedBool = true;
                break;
            case '--reverse':
            case '-s':
                options.reverse = assumedBoolValue;
                consumedBool = true;
                break;
            case '--unique':
            case '-u':
                options.unique = assumedBoolValue;
                consumedBool = true;
                break;
            case '--markdown':
            case '-m':
                options.markdown = assumedBoolValue;
                consumedBool = true;
                break;
            case '--regex':
                requireNextArg(i);

                try {
                    options.regexFilter = parseStringAsRegex(args[i + 1]);
                } catch (err: any) {
                    errors.push(err.message);
                }

                i++;

                break;
            case '--use-matched-regex':
            case '-p':
                options.useMatchedRegex = assumedBoolValue;
                consumedBool = true;
                break;
            case '--section-seperator':
                requireNextArg(i);

                try {
                    options.sectionSeperator = parseStringAsRegex(args[i + 1]);
                } catch (err: any) {
                    errors.push(err.message);
                }

                i++;

                break;
            case '--non-matching-to-bottom':
            case '-a':
                options.nonMatchingToBottom = assumedBoolValue;
                consumedBool = true;
                break;
            default:
                matchedCase = false;

                if (unknownArgCallback) {
                    unknownArgCallback(args, i, options);
                } else {
                    errors.push('Unknown option: ' + arg);
                }
        }

        // kinda weird but this is how I'll check
        // if --no- prefix has been used on a non boolean param
        // prob a better way to do this, and this is error prone
        if (!assumedBoolValue && !consumedBool && matchedCase) {
            errors.push(
                'Used --no- prefix on property that does not expect booleans'
            );
        }
    }

    return { errors, positionals, options };
}
