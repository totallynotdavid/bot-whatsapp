# Vendored: mitex 0.2.7

`mitex/` is the `@preview/mitex` Typst package, version 0.2.7, downloaded from
`https://packages.typst.org/preview/mitex-0.2.7.tar.gz` (md5
`f2d6ec28675218ce5feb18925771552a`). It converts LaTeX math into Typst markup
that `typst-latex-renderer.ts` compiles. Apache-2.0, see `mitex/LICENSE`.

The directory holds the files of the tarball except `CHANGELOG.md`, `README.md`
and `specs/README.md`. `typst.toml` ends with a newline, which the tarball's
copy lacks.

It is vendored, not fetched through Typst's `@preview` package registry, so
rendering needs no network access and the version is pinned.

## Upgrade

Download into a new empty directory, replace `mitex/` with the files above, and
change the version and the md5 in this file.

```bash
version=0.2.7
workdir=$(mktemp -d)
curl -fsSL -o "$workdir/mitex.tar.gz" \
  "https://packages.typst.org/preview/mitex-$version.tar.gz"
md5sum "$workdir/mitex.tar.gz"
tar -xzf "$workdir/mitex.tar.gz" -C "$workdir"
```

Do not edit the package's files by hand. Run `bun run test` afterwards:
`tests/typst-latex-renderer.test.ts` renders real LaTeX through it.
