import kuromoji, { Tokenizer, IpadicFeatures } from 'kuromoji'

export const isMatchObject = (tester: object, obj: object): boolean => {
    return Object.keys(tester).every(
        k => (tester as any)[k] === (obj as any)[k]
    )
}

export class TokenReplacer<F extends IpadicFeatures = IpadicFeatures> {
    protected tokenizer: Tokenizer<F>

    protected replacerPairs: [
        Partial<F>,
        (left: F | void, mid: F, right: F | void) => F | F[]
    ][] = []

    constructor(tokenizer: Tokenizer<F>) {
        this.tokenizer = tokenizer
    }

    protected tokenize(text: string): F[] {
        return this.tokenizer.tokenize(text)
    }

    protected textize(tokens: F[]): string {
        return tokens.reduce((text, token) => text + token.surface_form, '')
    }

    register(
        feature: Partial<F>,
        replacer: (left: F | void, mid: F, right: F | void) => F | F[]
    ): this {
        this.replacerPairs.push([feature, replacer])
        return this
    }

    replaceToken(left: F | void, mid: F, right: F | void): F | F[] {
        for (const [f, r] of this.replacerPairs) {
            if (isMatchObject(f, mid)) {
                return r(left, mid, right)
            }
        }
        return mid
    }

    replacedToken(tokens: F[]): F[] {
        return Array.prototype.concat(
            ...tokens.map((token, i, tokens) =>
                this.replaceToken(tokens[i - 1], token, tokens[i + 1])
            )
        )
    }

    replace(text: string): string {
        return this.textize(this.replacedToken(this.tokenize(text)))
    }
}

const dictpath = 'node_modules/kuromoji/dict'

void (async () => {
    const [err, tokenizer] = await new Promise<
        [Error, Tokenizer<IpadicFeatures>]
    >(resolve => {
        kuromoji
            .builder({ dicPath: dictpath })
            .build((err, tokenizer) => resolve([err, tokenizer]))
    })

    if (err) throw err

    const ojou = new TokenReplacer(tokenizer)
        .register(
            {
                pos: '名詞',
                pos_detail_2: '人名',
            },
            () => tokenizer.tokenize('さま')
        )
        .register(
            {
                pos: '動詞',
                conjugated_form: '未然形',
                surface_form: 'ん',
            },
            () => tokenizer.tokenize('な')
        )
        .register({}, (left, mid, right) => {
            if (!right) return [mid, ...tokenizer.tokenize('ですわ')]
            return mid
        })

    const text =
        '看護師さま強すぎて注射針刺さったのも抜かれたのも分からんかった'
    console.log(tokenizer.tokenize(text))
    console.log(ojou.replace(text))
})()
