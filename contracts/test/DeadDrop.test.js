const { expect } = require("chai");
const { ethers } = require("hardhat");

const PQC = "0x0000000000000000000000000000000000000a02";
const sha3 = (b) => ethers.keccak256(b); // stand-in hash for tests; the app uses SHA3-256
const rid = () => ethers.hexlify(ethers.randomBytes(32));

async function installPqc() {
  const mock = await (await ethers.getContractFactory("MockPqcKeyStatus")).deploy();
  await ethers.provider.send("hardhat_setCode", [PQC, await ethers.provider.getCode(mock.target)]);
  return ethers.getContractAt("MockPqcKeyStatus", PQC);
}

describe("DeadDrop", () => {
  let dd, pqc, owner, relayer, journalist, editor, outsider;
  const env = ethers.toUtf8Bytes("QSEAL…ciphertext…"); // pretend envelope

  beforeEach(async () => {
    [owner, relayer, journalist, editor, outsider] = await ethers.getSigners();
    pqc = await installPqc();
    await pqc.set(relayer.address, true);
    dd = await (await ethers.getContractFactory("DeadDrop")).deploy(relayer.address, PQC);
  });

  const submitInline = (id, recipients = [journalist.address, editor.address], e = env) =>
    dd.connect(relayer).submit(id, recipients, sha3(e), e.length, "", e);

  describe("submission", () => {
    it("anchors an inline envelope and emits the ciphertext", async () => {
      const id = rid();
      await expect(submitInline(id))
        .to.emit(dd, "Submitted")
        .withArgs(id, [journalist.address, editor.address], sha3(env), env.length, "", ethers.hexlify(env));
      const s = await dd.submissions(id);
      expect(s.envelopeSha3).to.equal(sha3(env));
      expect(s.inline_).to.equal(true);
      expect(await dd.submissionCount()).to.equal(1);
    });

    it("anchors a large envelope by hash + uri only", async () => {
      const id = rid();
      await dd.connect(relayer).submit(id, [journalist.address], sha3(env), 500000, "blob://x", "0x");
      expect((await dd.submissions(id)).inline_).to.equal(false);
    });

    it("refuses duplicates, bad recipients and inconsistent envelopes", async () => {
      const id = rid();
      await submitInline(id);
      await expect(submitInline(id)).to.be.revertedWithCustomError(dd, "AlreadySubmitted");
      await expect(submitInline(rid(), [])).to.be.revertedWithCustomError(dd, "BadRecipients");
      await expect(dd.connect(relayer).submit(rid(), [journalist.address], sha3(env), 999, "", env))
        .to.be.revertedWithCustomError(dd, "BadEnvelope"); // size mismatch
      await expect(dd.connect(relayer).submit(rid(), [journalist.address], sha3(env), 10, "", "0x"))
        .to.be.revertedWithCustomError(dd, "BadEnvelope"); // neither inline nor uri
      const big = new Uint8Array(48 * 1024 + 1);
      await expect(dd.connect(relayer).submit(rid(), [journalist.address], sha3(big), big.length, "", big))
        .to.be.revertedWithCustomError(dd, "BadEnvelope"); // over MAX_INLINE
    });

    it("only the relayer can submit", async () => {
      await expect(dd.connect(outsider).submit(rid(), [journalist.address], sha3(env), env.length, "", env))
        .to.be.revertedWithCustomError(dd, "NotRelayer");
    });

    it("matches() is the Proof of Silence check", async () => {
      const id = rid();
      await submitInline(id);
      expect(await dd.matches(id, sha3(env))).to.equal(true);
      expect(await dd.matches(id, sha3(ethers.toUtf8Bytes("tampered")))).to.equal(false);
      expect(await dd.matches(rid(), sha3(env))).to.equal(false);
    });
  });

  describe("acknowledgement", () => {
    it("a recipient can acknowledge; others cannot", async () => {
      const id = rid();
      const rec = [journalist.address, editor.address];
      await submitInline(id, rec);
      await expect(dd.connect(journalist).acknowledge(id, rec)).to.emit(dd, "Acknowledged").withArgs(id, journalist.address);
      expect(await dd.acknowledged(id, journalist.address)).to.equal(true);
      await expect(dd.connect(outsider).acknowledge(id, rec)).to.be.revertedWithCustomError(dd, "NotARecipient");
      await expect(dd.connect(journalist).acknowledge(id, [journalist.address])).to.be.revertedWithCustomError(dd, "BadRecipients");
      await expect(dd.connect(journalist).acknowledge(rid(), rec)).to.be.revertedWithCustomError(dd, "UnknownSubmission");
    });
  });

  describe("post-quantum key check (pqcKeyStatus precompile)", () => {
    it("cannot be deployed with a relayer that has no PQC key", async () => {
      const F = await ethers.getContractFactory("DeadDrop");
      await expect(F.deploy(outsider.address, PQC)).to.be.revertedWithCustomError(dd, "NoPqcKey").withArgs(outsider.address);
    });

    it("relayer cannot submit once its PQC key is gone", async () => {
      await pqc.set(relayer.address, false);
      await expect(submitInline(rid())).to.be.revertedWithCustomError(dd, "NoPqcKey").withArgs(relayer.address);
    });

    it("owner can only appoint a relayer with a PQC key", async () => {
      await expect(dd.setRelayer(outsider.address)).to.be.revertedWithCustomError(dd, "NoPqcKey");
      await expect(dd.connect(outsider).setRelayer(outsider.address)).to.be.revertedWithCustomError(dd, "NotOwner");
      await pqc.set(outsider.address, true);
      await expect(dd.setRelayer(outsider.address)).to.emit(dd, "RelayerChanged").withArgs(outsider.address);
    });
  });
});
