"""実行で退避した alias-inject の端末の設定のうち、最も新しいものへ書き戻す。"""

import glob
import os
import shutil
import sys

TARGET = os.path.expanduser("~/.config/alias-inject/settings.yaml")

backups = sorted(glob.glob(f"{TARGET}.bak-[0-9]*-[0-9]*"))
if not backups:
    print("退避したファイル: failed")
    sys.exit(1)
shutil.copy2(backups[-1], TARGET)
print(f"設定の書き戻し: changed（{backups[-1]}）")
