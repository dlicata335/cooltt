FROM alpine:3.14

WORKDIR "/src/"

COPY ["dune-project", "dune-project"]
COPY ["cooltt.opam", "cooltt.opam"]

# If only the OPAM is modified, Docker should start from here.
# We copy dune-project because dune _could_ generate OPAM files from dune-project (not used in cooltt)

# Rationale of using one step for both system and OPAM dependencies:
# Otherwise, it seems we will hit the (seemingly) size limit of Github Action caching.

# System dependencies:
# ocaml, ocaml-compiler-libs | OCaml
# opam                       | OPAM
# make, m4, musl-dev         | Requird by many OPAM packages
# git                        | Get yuujinchou and bantorra
# python2, gmp-dev           | z3
# ocaml-ocamldoc             | Zarith (which is required by z3)
RUN \
  apk add --no-cache ocaml ocaml-ocamldoc ocaml-compiler-libs opam make m4 musl-dev git python2 gmp-dev && \
  opam init --disable-sandboxing --disable-completion --no-setup --yes && \
  opam install --deps-only --yes --with-test --with-doc "./"

COPY ["Makefile", "Makefile"]
COPY ["src", "src"]
COPY ["test", "test"]

RUN \
  opam exec -- dune build --profile static && \
  opam exec -- dune install --section bin

ENTRYPOINT ["opam", "exec", "--", "cooltt"]
