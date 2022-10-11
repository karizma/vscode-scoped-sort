// @ts-check
const { tokenizeArgString, parseArgsIntoOptions } = require('../dist/parser');
const test = require('tape');

test('test regex parser', (t) => {
    /**
     * @param {string} input
     * @param {RegExp} expected
     * @param {string} msg
     */
    function expectRegex(input, expected, msg) {
        t.deepEquals(
            parseArgsIntoOptions(tokenizeArgString('--regex ' + input)),
            { options: { regexFilter: expected }, errors: [], positionals: [] },
            msg
        );
    }

    /**
     * @param {string} input
     * @param {string} expected
     * @param {string} msg
     */
    function expectError(input, expected, msg) {
        t.deepEquals(
            parseArgsIntoOptions(tokenizeArgString('--regex ' + input)),
            { errors: [expected], positionals: [], options: {} },
            msg
        );
    }

    expectRegex('/\\d/', /\d/, 'regular regex');
    expectRegex('/\\d/i', /\d/i, 'regular regex with i flag');
    expectRegex('/\\{/', /\{/, 'regex with escaped {');
    expectRegex(`/\\"/`, /\"/, 'regex with blackslash for quote');

    // might seem weird how the program lists 'd' or 'd/' as the input,
    // this is because the tokenizer ignores \\ if not inside of a regex
    // /\\d is still outputed as /\\d because of the starting slash
    //
    // this is an issue, and thinking of how to fix it
    expectError(
        '\\d',
        "Expected regex, got: '\\d'",
        'no starting and ending slash'
    );
    expectError('/\\d', "Expected regex, got: '/\\d'", 'no ending slash');
    expectError('\\d/', "Expected regex, got: '\\d/'", 'no starting slash');
    expectError(
        '/\\d/m',
        "The only regex flag allowed is 'i'. Recieved: 'm'",
        'invalid flag'
    );

    t.end();
});

test('string argument tokenizer', (t) => {
    t.deepEquals(
        tokenizeArgString('--hi there --my name is jake'),
        ['--hi', 'there', '--my', 'name', 'is', 'jake'],
        'basic arguments'
    );

    t.deepEquals(
        tokenizeArgString('--hi \t\t  there     yolo'),
        ['--hi', 'there', 'yolo'],
        'basic arguments with multiple spaces in between'
    );

    t.deepEquals(
        tokenizeArgString('--hi there "/i love you/"'),
        ['--hi', 'there', '/i love you/'],
        'quoted arguments with multiple spaces'
    );

    t.deepEquals(
        tokenizeArgString(
            `--hi "there \\\"my\\\"" name is jake 'you \\\'feel\\\' me?'`
        ),
        ['--hi', 'there "my"', 'name', 'is', 'jake', "you 'feel' me?"],
        'quoted arguments'
    );

    t.deepEquals(
        tokenizeArgString('--section-seperator /\\w+/'),
        ['--section-seperator', '/\\w+/'],
        'backslash inside regex'
    );

    t.deepEquals(tokenizeArgString('-su'), ['-su'], 'short option group');

    t.deepEquals(
        tokenizeArgString('-s3u'),
        ['-s3u'],
        'short option group works with arguments right next'
    );

    t.deepEquals(
        tokenizeArgString('--regex /\\"/'),
        ['--regex', '/\\"/'],
        'backslash before "'
    );

    t.end();
});

test('arg array into options (single options)', (t) => {
    /**
     * @param {string[]} args
     * @param {import('../dist/main').Options} options
     */
    function expectOptions(args, options) {
        t.deepEquals(parseArgsIntoOptions(args), {
            options,
            errors: [],
            positionals: [],
        });
    }

    /**
     * @param {string} main
     * @param {string} alias
     * @param {import('../dist/main').Options} options
     */
    function expectOptionsWithSingleAndAlias(main, alias, options) {
        expectOptions([main], options);
        expectOptions([alias], options);
    }

    /**
     * @param {string} main
     * @param {string} alias
     * @param {import('../dist/main').Options} options
     */
    function expectBooleanOptionsWithSingleAndAlias(main, alias, options) {
        expectOptionsWithSingleAndAlias(main, alias, options);

        for (const [key, value] of Object.entries(options)) {
            if (typeof value === 'boolean') {
                options[key] = !value;
            }
        }

        expectOptions(['--no-' + main.slice(2)], options);
        expectOptions(['--no-' + alias.slice(1)], options);
    }

    expectOptionsWithSingleAndAlias('--case-insensitive', '-i', {
        sorter: 'case-insensitive',
    });

    expectOptionsWithSingleAndAlias('--natural-sort', '-e', {
        sorter: 'natural',
    });

    expectOptionsWithSingleAndAlias('--numerical-sort', '-n', {
        sorter: 'numerical',
    });

    expectOptionsWithSingleAndAlias('--float-sort', '-f', {
        sorter: 'float',
    });

    expectOptionsWithSingleAndAlias('--length-sort', '-l', {
        sorter: 'length',
    });

    expectOptionsWithSingleAndAlias('--random-sort', '-z', {
        sorter: 'random',
    });

    expectBooleanOptionsWithSingleAndAlias('--recursive', '-r', {
        recursive: true,
    });

    expectBooleanOptionsWithSingleAndAlias('--reverse', '-s', {
        reverse: true,
    });

    expectBooleanOptionsWithSingleAndAlias('--unique', '-u', {
        unique: true,
    });

    expectBooleanOptionsWithSingleAndAlias('--markdown', '-m', {
        markdown: true,
    });

    expectBooleanOptionsWithSingleAndAlias('--use-matched-regex', '-p', {
        useMatchedRegex: true,
    });

    expectBooleanOptionsWithSingleAndAlias('--non-matching-to-bottom', '-a', {
        nonMatchingToBottom: true,
    });

    t.end();
});

test('arg array into options (combining options)', (t) => {
    /**
     * @param {string[]|string} args
     * @param {import('../dist/main').Options} options
     */
    function expectOptions(args, options) {
        if (typeof args === 'string') {
            args = tokenizeArgString(args);
        }

        t.deepEquals(parseArgsIntoOptions(args), {
            options,
            positionals: [],
            errors: [],
        });
    }

    /**
     * @param {string[]|string} args
     * @param {string} msg
     */
    function expectError(args, msg) {
        if (typeof args === 'string') {
            args = tokenizeArgString(args);
        }

        t.deepEquals(parseArgsIntoOptions(args).errors, [msg]);
    }

    expectOptions('-su', {
        reverse: true,
        unique: true,
    });

    expectOptions('-nu', {
        sorter: 'numerical',
        unique: true,
    });

    expectOptions('-s --regex /\\w/', {
        reverse: true,
        regexFilter: /\w/,
    });

    expectOptions('-sp --regex /\\w/', {
        reverse: true,
        regexFilter: /\w/,
        useMatchedRegex: true,
    });

    expectOptions('-s --regex /\\w/ -p', {
        reverse: true,
        regexFilter: /\w/,
        useMatchedRegex: true,
    });

    expectOptions('--sectionSeperator /^Title/', {
        sectionSeperator: /^Title/,
    });

    expectOptions('--section-seperator "/^  <div/"', {
        sectionSeperator: /^  <div/,
    });

    expectError('--hi', 'Unknown option: --hi');
    expectError(
        '--numerical-sort --random-sort',
        "Can't have more than one sorter"
    );

    t.deepEquals(parseArgsIntoOptions(tokenizeArgString('hi there you')), {
        positionals: ['hi', 'there', 'you'],
        errors: [],
        options: {},
    });

    t.end();
});
