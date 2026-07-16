export type Points = {
  x: number;
  y: number;
};

export type BaseShape =
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      type: "ellipse";
      radX: number;
      radY: number;
      centerX: number;
      centerY: number;
    }
  | {
      type: "diamond";
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      top: number;
      left: number;
    }
  | {
      type: "line";
      sX: number;
      sY: number;
      eX: number;
      eY: number;
    }
  | {
      type: "pencil";
      points: Array<Points>;
    }
  | {
      type: "hand";
    }
  | {
      type: "arrow";
      sX: number;
      sY: number;
      eX: number;
      eY: number;
    };

export type Shape = BaseShape & {
  id: string;
};
