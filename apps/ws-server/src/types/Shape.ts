type Color = string;

interface BaseShape {
      id: string;

      strokeColor: Color;
      fillColor: Color;

      strokeWidth: number;

      strokeStyle: "solid" | "dashed" | "dotted";
      fillStyle: "solid" | "cross-hatch" | "hachure"; 

      opacity: number;

     // rotation: number;
}

type Points = {
  x: number;
  y: number;
};

interface Rect extends BaseShape{
      id : string;
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
};

interface Ellipse extends BaseShape{
      type: "ellipse";
      radX: number;
      radY: number;
      centerX: number;
      centerY: number;
};

interface Diamond extends BaseShape{
      type: "diamond";
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      top: number;
      left: number;
}

interface Line extends BaseShape{
      type: "line";
      sX: number;
      sY: number;
      eX: number;
      eY: number;
};

interface Pencil extends BaseShape{
      type: "pencil";
      points: Array<Points>;
};

interface Arrow extends BaseShape{
      type: "arrow";
      eX: number;
      eY: number;
      sX: number;
      sY: number;
}

export type Shape = Rect | Ellipse | Diamond | Line | Pencil | Arrow;