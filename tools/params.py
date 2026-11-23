#!/usr/bin/env python3
"""DeepLearn Lab - tools/params.py

Computes tensor shapes and parameter counts for the architectures used in the
lessons. Never recall these numbers from memory: run this script and paste the
table it prints.

Usage
    python tools/params.py              # every model
    python tools/params.py resnet18     # one model
    python tools/params.py --json       # machine-readable
"""
import json
import sys

def conv_out(h, k, s=1, p=0, d=1):
    return (h + 2 * p - d * (k - 1) - 1) // s + 1

def conv_params(cin, cout, k, bias=True):
    return k * k * cin * cout + (cout if bias else 0)

def fc_params(nin, nout, bias=True):
    return nin * nout + (nout if bias else 0)

def human(n):
    if n >= 1_000_000:
        return f"{n:,} ({n/1e6:.2f}M)"
    if n >= 1_000:
        return f"{n:,} ({n/1e3:.1f}K)"
    return f"{n:,}"

class Stack:
    def __init__(self, h, w, c=3, batch=1):
        self.h, self.w, self.c = h, w, c
        self.batch = batch
        self.rows = []
        self.total = 0

    def _row(self, name, shape_out, params):
        self.total += params
        self.rows.append({
            "layer": name,
            "out": str(shape_out),
            "params": params,
        })

    def conv(self, cout, k=3, s=1, p=0, d=1, bias=True, pool=None, name=None):
        oh = conv_out(self.h, k, s, p, d)
        ow = conv_out(self.w, k, s, p, d)
        n = conv_params(self.c, cout, k, bias)
        label = name or f"Conv2d({self.c}->{cout}, {k}x{k}, s={s}, p={p}" + (f", d={d}" if d > 1 else "") + ")"
        self._row(label, (self.batch, cout, oh, ow), n)
        self.h, self.w, self.c = oh, ow, cout
        if pool:
            pk, ps = pool
            oh2 = conv_out(self.h, pk, ps, 0)
            ow2 = conv_out(self.w, pk, ps, 0)
            self._row(f"Pool {pk}x{pk}/s{ps}", (self.batch, self.c, oh2, ow2), 0)
            self.h, self.w = oh2, ow2

    def bn(self, c=None):
        c = c or self.c
        self._row(f"BatchNorm2d({c})", (self.batch, self.c, self.h, self.w), 2 * c)

    def gap(self):
        self._row("AdaptiveAvgPool2d(1)", (self.batch, self.c, 1, 1), 0)
        self.h, self.w = 1, 1

    def flatten(self):
        n = self.c * self.h * self.w
        self._row("Flatten", (self.batch, n), 0)
        return n

    def fc(self, nout, bias=True, name=None):
        nin = self.c * self.h * self.w
        n = fc_params(nin, nout, bias)
        self._row(name or f"Linear({nin}->{nout})", (self.batch, nout), n)
        self.c, self.h, self.w = nout, 1, 1

    def dropout(self, p=0.5):
        self._row(f"Dropout(p={p})", (self.batch, self.c, self.h, self.w), 0)

    def table(self, title):
        lines = [f"### {title}", "", "| layer | output (N,C,H,W) | params |", "|---|---|---|"]
        for r in self.rows:
            lines.append(f"| {r['layer']} | {r['out']} | {r['params']:,} |")
        lines.append(f"| **total** | | **{human(self.total)}** |")
        return "\n".join(lines)


def resnet_block(st, cout, stride=1, name="BasicBlock"):
    """A ResNet basic block (two 3x3 convs + identity)."""
    before = st.total
    cin = st.c
    st.conv(cout, 3, stride, 1, name=f"  conv1 3x3 ({cin}->{cout}, s={stride})")
    st.bn()
    st.conv(cout, 3, 1, 1, name=f"  conv2 3x3 ({cout}->{cout})")
    st.bn()
    if stride != 1 or cin != cout:
        st.conv(cout, 1, stride, 0, name=f"  downsample 1x1 ({cin}->{cout}, s={stride})")
        st.bn()
    return st.total - before


def resnet18():
    """ResNet-18 as torchvision defines it: conv bias=False before every BN."""
    st = Stack(224, 224, 3)
    st.conv(64, 7, 2, 3, bias=False, name="conv1 7x7 (3->64, s=2, b=False)")
    st.bn(64)
    st._row("MaxPool 3x3/s2", (1, 64, 56, 56), 0)
    st.h, st.w = 56, 56
    stage = 0
    for cout, blocks, stride in [(64, 2, 1), (128, 2, 2), (256, 2, 2), (512, 2, 2)]:
        stage += 1
        for b in range(blocks):
            s = stride if b == 0 else 1
            cin = st.c                       # block input channels (before conv1)
            st.conv(cout, 3, s, 1, bias=False,
                    name=f"layer{stage}.{b}.conv1 3x3 ({cin}->{cout}, s={s}, b=False)")
            st.bn()
            st.conv(cout, 3, 1, 1, bias=False,
                    name=f"layer{stage}.{b}.conv2 3x3 ({cout}->{cout}, b=False)")
            st.bn()
            if s != 1 or cin != cout:
                # 1x1 projection applied to the BLOCK INPUT, not to conv2's output
                n = conv_params(cin, cout, 1, bias=False)
                st._row(f"layer{stage}.{b}.downsample 1x1 ({cin}->{cout}, s={s}, b=False)",
                        (1, cout, st.h, st.w), n)
                st._row(f"layer{stage}.{b}.downsample BN", (1, cout, st.h, st.w), 2 * cout)
    st.gap()
    n = st.flatten()
    st.fc(1000, name=f"fc ({n}->1000)")
    return st


def lenet():
    st = Stack(28, 28, 1)
    st.conv(6, 5, 1, 0, name="conv1 5x5 (1->6)")
    st._row("AvgPool 2x2/s2", (1, 6, 14, 14), 0); st.h, st.w = 14, 14
    st.conv(16, 5, 1, 0, name="conv2 5x5 (6->16)")
    st._row("AvgPool 2x2/s2", (1, 16, 5, 5), 0); st.h, st.w = 5, 5
    n = st.flatten()
    st.fc(120, name=f"fc1 ({n}->120)")
    st.fc(84, name="fc2 (120->84)")
    st.fc(10, name="fc3 (84->10)")
    return st


def alexnet():
    st = Stack(224, 224, 3)
    st.conv(64, 11, 4, 2, name="conv1 11x11 (3->64, s=4)")
    st._row("MaxPool 3x3/s2", (1, 64, 27, 27), 0); st.h, st.w = 27, 27
    st.conv(192, 5, 1, 2, name="conv2 5x5 (64->192)")
    st._row("MaxPool 3x3/s2", (1, 192, 13, 13), 0); st.h, st.w = 13, 13
    st.conv(384, 3, 1, 1, name="conv3 3x3 (192->384)")
    st.conv(256, 3, 1, 1, name="conv4 3x3 (384->256)")
    st.conv(256, 3, 1, 1, name="conv5 3x3 (256->256)")
    st._row("MaxPool 3x3/s2", (1, 256, 6, 6), 0); st.h, st.w = 6, 6
    n = st.flatten()
    st.fc(4096, name=f"fc1 ({n}->4096)")
    st.dropout(0.5)
    st.fc(4096, name="fc2 (4096->4096)")
    st.dropout(0.5)
    st.fc(1000, name="fc3 (4096->1000)")
    return st


def vgg16():
    st = Stack(224, 224, 3)
    cfg = [(64, 2), (128, 2), (256, 3), (512, 3), (512, 3)]
    for cout, blocks in cfg:
        for b in range(blocks):
            st.conv(cout, 3, 1, 1, name=f"conv {cout} 3x3 #{b+1}")
        st._row("MaxPool 2x2/s2", (1, st.c, st.h // 2, st.w // 2), 0)
        st.h //= 2; st.w //= 2
    n = st.flatten()
    st.fc(4096, name=f"fc1 ({n}->4096)")
    st.dropout(0.5)
    st.fc(4096, name="fc2 (4096->4096)")
    st.dropout(0.5)
    st.fc(1000, name="fc3 (4096->1000)")
    return st


def cifar_cnn():
    st = Stack(32, 32, 3, batch=64)
    st.conv(32, 3, 1, 1); st.bn(); st.conv(32, 3, 1, 1); st.bn()
    st._row("MaxPool 2x2/s2", (64, 32, 16, 16), 0); st.h, st.w = 16, 16
    st.conv(64, 3, 1, 1); st.bn(); st.conv(64, 3, 1, 1); st.bn()
    st._row("MaxPool 2x2/s2", (64, 64, 8, 8), 0); st.h, st.w = 8, 8
    st.conv(128, 3, 1, 1); st.bn(); st.conv(128, 3, 1, 1); st.bn()
    st.gap()
    n = st.flatten()
    st.fc(10, name=f"fc ({n}->10)")
    return st


def unet(base=64, depth=4, in_ch=3, classes=1, size=256):
    st = Stack(size, size, in_ch)
    channels = [base * (2 ** i) for i in range(depth + 1)]
    # encoder
    for i in range(depth):
        cin = st.c
        st.conv(channels[i], 3, 1, 1, name=f"enc{i} conv1 3x3 ({cin}->{channels[i]})")
        st.conv(channels[i], 3, 1, 1, name=f"enc{i} conv2 3x3 ({channels[i]}->{channels[i]})")
        st._row("MaxPool 2x2", (1, st.c, st.h // 2, st.w // 2), 0)
        st.h //= 2; st.w //= 2
    # bottleneck
    cin = st.c
    st.conv(channels[depth], 3, 1, 1, name=f"bottleneck conv 3x3 ({cin}->{channels[depth]})")
    st.conv(channels[depth], 3, 1, 1, name="bottleneck conv 3x3")
    # decoder
    for i in range(depth - 1, -1, -1):
        st._row("Upsample x2", (1, st.c, st.h * 2, st.w * 2), 0)
        st.h *= 2; st.w *= 2
        cin = st.c + channels[i]  # skip concatenation
        st.conv(channels[i], 3, 1, 1, name=f"dec{i} conv1 3x3 ({cin}->{channels[i]}, after skip)")
        st.conv(channels[i], 3, 1, 1, name=f"dec{i} conv2 3x3 ({channels[i]}->{channels[i]})")
    st.conv(classes, 1, 1, 0, name=f"head 1x1 ({st.c}->{classes})")
    return st


def dcgan_g(z=100, out=64):
    st = Stack(1, 1, z)
    st._row(f"Input z ({z})", (1, z, 1, 1), 0)
    plan = [(512, 4, 1, 0), (256, 4, 2, 1), (128, 4, 2, 1), (64, 4, 2, 1), (3, 4, 2, 1)]
    h = 1
    for cout, k, s, p in plan:
        oh = (h - 1) * s - 2 * p + k
        st._row(f"ConvT2d({st.c}->{cout}, {k}x{k}, s={s}, p={p})",
                (1, cout, oh, oh), conv_params(st.c, cout, k))
        st.c = cout
        h = oh
        if cout != 3:
            st.bn(cout)
        else:
            st._row("Tanh", (1, cout, oh, oh), 0)
    return st


def dcgan_d(out=64):
    st = Stack(64, 64, 3)
    plan = [(64, 4, 2, 1), (128, 4, 2, 1), (256, 4, 2, 1), (512, 4, 2, 1)]
    for cout, k, s, p in plan:
        oh = conv_out(st.h, k, s, p)
        st._row(f"Conv2d({st.c}->{cout}, {k}x{k}, s={s}, p={p}, leaky)",
                (1, cout, oh, oh), conv_params(st.c, cout, k))
        st.c = cout; st.h = oh; st.w = oh
        if cout != 512:
            st.bn(cout)
    st._row("Conv2d(512->1, 4x4, s=1, p=0)", (1, 1, 1, 1), conv_params(512, 1, 4))
    st._row("Sigmoid", (1, 1, 1, 1), 0)
    return st


def depthwise_separable(cin, cout, k=3):
    dw = k * k * cin + cin
    pw = cin * cout + cout
    std = conv_params(cin, cout, k)
    return {"depthwise": dw, "pointwise": pw, "separable": dw + pw, "standard": std,
            "ratio": (dw + pw) / std}


MODELS = {
    "lenet": ("LeNet-5, 1x28x28 -> 10", lenet),
    "alexnet": ("AlexNet, 3x224x224 -> 1000", alexnet),
    "vgg16": ("VGG-16, 3x224x224 -> 1000", vgg16),
    "resnet18": ("ResNet-18, 3x224x224 -> 1000", resnet18),
    "cifar_cnn": ("CIFAR-10 CNN, 3x32x32, batch 64", cifar_cnn),
    "unet": ("U-Net, 3x256x256 -> 1, base 64, depth 4", unet),
    "dcgan_g": ("DCGAN generator, z=100 -> 3x64x64", dcgan_g),
    "dcgan_d": ("DCGAN discriminator, 3x64x64", dcgan_d),
}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    as_json = "--json" in sys.argv
    wanted = args if args else list(MODELS.keys())

    if as_json:
        payload = {}
        for key in wanted:
            if key not in MODELS:
                continue
            title, fn = MODELS[key]
            st = fn()
            payload[key] = {"title": title, "total": st.total, "rows": st.rows}
        print(json.dumps(payload, indent=2))
        return 0

    for key in wanted:
        if key not in MODELS:
            print(f"unknown model: {key}")
            continue
        title, fn = MODELS[key]
        st = fn()
        print(st.table(title))
        print()

    # depthwise-separable comparison, always useful
    if not args:
        print("### Depthwise-separable cost (k=3)")
        print()
        print("| cin -> cout | depthwise | pointwise | separable | standard | ratio |")
        print("|---|---|---|---|---|---|")
        for cin, cout in [(3, 32), (32, 64), (64, 128), (128, 256)]:
            d = depthwise_separable(cin, cout)
            print(f"| {cin}->{cout} | {d['depthwise']:,} | {d['pointwise']:,} | "
                  f"{d['separable']:,} | {d['standard']:,} | {d['ratio']:.3f} |")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
